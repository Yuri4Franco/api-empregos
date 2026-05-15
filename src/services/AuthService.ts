import { prisma } from "../config/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { EmailService } from "./EmailService.js";

const emailService = new EmailService();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export class AuthService {
  // #region FUNCIONALIDADES DE AUTENTICAÇÃO E GERAÇÃO DE TOKENS
  async loginPorEmail(email: string, senha_pura: string) {
    console.log("email que chegou:", email);
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) throw new Error("Credenciais inválidas.");

    if (usuario.status == "PENDENTE") {
      throw new Error(
        "Verifique seu email e ative a sua conta. Contate a ACI.",
      );
    }

    if (usuario.status == "BLOQUEADO") {
      throw new Error("Acesso em análise ou suspenso. Contate a ACI.");
    }

    const senhaValida = await argon2.verify(usuario.senha_hash, senha_pura);
    if (!senhaValida) throw new Error("Credenciais inválidas.");

    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { ultimo_login: new Date() },
    });

    return this.gerarToken(
      usuario.id_usuario,
      usuario.tipo_usuario,
      usuario.is_master,
      usuario.exigir_troca_senha,
    );
  }

  // Login específico para empresas usando CNPJ
  async loginEmpresa(cnpj: string, senha_pura: string) {
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    const empresa = await prisma.empresa.findUnique({
      where: { cnpj: cnpjLimpo },
      include: {
        usuarios: true,
      },
    });

    if (!empresa || !empresa.usuarios || empresa.usuarios.length === 0) {
      throw new Error("Credenciais inválidas.");
    }
    const usuarioPrincipal = empresa.usuarios[0];

    if (!usuarioPrincipal) {
      throw new Error("Nenhum usuário vinculado a esta empresa.");
    }

    if (usuarioPrincipal.status !== "ATIVO") {
      throw new Error("Acesso em análise ou suspenso. Contate a ACI.");
    }

    const senhaValida = await argon2.verify(
      usuarioPrincipal.senha_hash,
      senha_pura,
    );
    if (!senhaValida) throw new Error("Credenciais inválidas.");

    return this.gerarToken(
      usuarioPrincipal.id_usuario,
      usuarioPrincipal.tipo_usuario,
      usuarioPrincipal.is_master,
      usuarioPrincipal.exigir_troca_senha,
    );
  }

  // #endregion FIM DAS FUNCIONALIDADES DE AUTENTICAÇÃO E GERAÇÃO DE TOKENS

  // #region FUNÇÃO AUXILIAR PARA GERAR TOKENS JWT
  private gerarToken(
    id_usuario: number,
    tipo: string,
    is_master: boolean,
    exigir_troca_senha: boolean,
  ) {
    if (typeof JWT_SECRET !== "string") {
      throw new Error("Erro interno: JWT_SECRET não definida.");
    }

    const payload = {
      sub: id_usuario,
      role: tipo,
      master: is_master,
      exigir_troca_senha: exigir_troca_senha,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      ...(JWT_EXPIRES_IN
        ? { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
        : {}),
    } as jwt.SignOptions);

    return { token, tipo, exigir_troca_senha };
  }

  // #endregion FIM DA FUNÇÃO AUXILIAR PARA GERAR TOKENS JWT
  async registrarCandidato(dados: any) {
    const { nome, email, senha } = dados;

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });
    if (usuarioExistente) throw new Error("Este e-mail já está cadastrado.");

    const senhaHash = await argon2.hash(senha);
    const tokenAtivacao = crypto.randomBytes(32).toString("hex");

    const resultado = await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({
        data: {
          nome,
          email,
          senha_hash: senhaHash,
          tipo_usuario: "CANDIDATO",
          status: "PENDENTE",
          token_ativacao: tokenAtivacao,
        },
      });

      await tx.candidato.create({
        data: {
          id_usuario: user.id_usuario,
          turno_preferido: ["QUALQUER_TURNO"],
          cnh: ["NAO_POSSUO"],
        },
      });

      return {
        id: user.id_usuario,
        email: user.email,
        nome: user.nome,
        token: tokenAtivacao,
      };
    });

    try {
      await emailService.enviarEmailAtivacao(
        resultado.email,
        resultado.nome,
        resultado.token,
      );
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
    }
    return { id: resultado.id, email: resultado.email };
  }

  async confirmarEmail(token: string) {
    const usuario = await prisma.usuario.findFirst({
      where: { token_ativacao: token },
    });

    if (!usuario) {
      throw new Error("Link de ativação inválido ou expirado.");
    }

    return await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        status: "ATIVO",
        token_ativacao: null,
      },
    });
  }

  async reenviarLinkAtivacao(email: string) {
    // 1. Busca o usuário pelo e-mail
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }

    // 2. Verifica se a conta já foi ativada
    if (usuario.status === "ATIVO") {
      throw new Error("Esta conta já está ativada. Você já pode fazer login.");
    }

    const novoToken = crypto.randomBytes(32).toString("hex");

    // 4. Atualiza o banco com o novo token
    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { token_ativacao: novoToken },
    });

    // 5. Reenvia o e-mail
    try {
      await emailService.enviarEmailAtivacao(
        usuario.email,
        usuario.nome,
        novoToken,
      );
    } catch (error) {
      console.error("Erro ao reenviar e-mail:", error);
      throw new Error(
        "Não foi possível enviar o e-mail no momento. Tente novamente mais tarde.",
      );
    }

    return true;
  }

  async solicitarRecuperacaoSenha(email: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) return;

    const token = crypto.randomBytes(32).toString("hex");
    const expiraToken = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        token_recuperar: token,
        expira_token: expiraToken,
      },
    });

    await emailService.enviarEmailRecuperacao(
      usuario.email,
      usuario.nome,
      token,
    );
  }

  // 2º Passo: Executar a redefinição com Argon2
  async redefinirSenha(token: string, novaSenha: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { token_recuperar: token },
    });

    if (
      !usuario ||
      !usuario.expira_token ||
      new Date() > usuario.expira_token
    ) {
      throw new Error(
        "Token de recuperação inválido ou expirado. Solicite novamente.",
      );
    }

    // ✨ AQUI ESTÁ A MÁGICA DO ARGON2
    // O argon2.hash já gera o salt automaticamente e usa os parâmetros recomendados
    const senhaHash = await argon2.hash(novaSenha);

    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        senha_hash: senhaHash,
        token_recuperar: null,
        expira_token: null,
      },
    });

    return true;
  } 
}
