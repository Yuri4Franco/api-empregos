import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { EmailService } from "./EmailService.js";
import { validarRecaptcha } from "../utils/validarRecaptcha.js";

const emailService = new EmailService();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export class AuthService {
  // #region FUNCIONALIDADES DE AUTENTICAÇÃO E GERAÇÃO DE TOKENS
  async loginPorEmail(email: string, senha_pura: string) {
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
      usuario.id_empresa,
      usuario.tipo_usuario,
      usuario.is_master,
      usuario.exigir_troca_senha,
    );
  }

  // Login específico para empresas usando CNPJ
  async loginPorCpf(cpf: string, senha_pura: string) {
    // 1. Remove pontos e traços do CPF
    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      throw new Error("CPF inválido. Informe os 11 dígitos.");
    }

    // 2. Busca o candidato pelo CPF e inclui o usuário relacional
    const candidato = await prisma.candidato.findFirst({
      where: { cpf: cpfLimpo },
      include: {
        usuario: true,
      },
    });

    if (!candidato || !candidato.usuario) {
      throw new Error("Credenciais inválidas.");
    }

    const usuario = candidato.usuario;

    // 3. Validações de status de conta
    if (usuario.status == "PENDENTE") {
      throw new Error(
        "Verifique seu email e ative a sua conta. Contate a ACI.",
      );
    }

    if (usuario.status == "BLOQUEADO") {
      throw new Error("Acesso em análise ou suspenso. Contate a ACI.");
    }

    // 4. Verificação criptográfica da senha com Argon2
    const senhaValida = await argon2.verify(usuario.senha_hash, senha_pura);
    if (!senhaValida) throw new Error("Credenciais inválidas.");

    // 5. Atualiza a data e hora do último login
    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { ultimo_login: new Date() },
    });

    // 6. Retorna o token JWT e dados de permissão
    return this.gerarToken(
      usuario.id_usuario,
      usuario.id_empresa,
      usuario.tipo_usuario,
      usuario.is_master,
      usuario.exigir_troca_senha,
    );
  }

  // #endregion FIM DAS FUNCIONALIDADES DE AUTENTICAÇÃO E GERAÇÃO DE TOKENS

  // #region FUNÇÃO AUXILIAR PARA GERAR TOKENS JWT
  private gerarToken(
    id_usuario: number,
    id_empresa: number | null,
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
      id_empresa: id_empresa,
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

    const resultado = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
            tipo_contato: ["WHATSAPP"],
          },
        });

        return {
          id: user.id_usuario,
          email: user.email,
          nome: user.nome,
          token: tokenAtivacao,
        };
      },
    );

    try {
      await emailService.enviarEmailConfirmacao(
        resultado.email,
        resultado.nome,
        resultado.token,
      );
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
    }
    return { id: resultado.id, email: resultado.email };
  }

  async registrarCandidatoComCpf(dados: {
    nome: string;
    email: string;
    cpf: string;
    senha: string;
    whatsapp?: string;
  }) {
    const { nome, email, cpf, senha, whatsapp } = dados;
    // 1. Limpa o CPF mantendo apenas números
    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      throw new Error("CPF inválido. Informe os 11 dígitos.");
    }

    // 2. Verifica se o e-mail já está em uso
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });
    if (usuarioExistente) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    // 3. Verifica se o CPF já está vinculado a algum candidato
    const candidatoExistente = await prisma.candidato.findFirst({
      where: { cpf: cpfLimpo },
    });
    if (candidatoExistente) {
      throw new Error("Este CPF já está cadastrado no sistema.");
    }

    // 4. Gera o hash da senha
    const senhaHash = await argon2.hash(senha);

    // 5. Cria o usuário e o candidato em uma transação atômica
    const novoUsuario = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const user = await tx.usuario.create({
          data: {
            nome,
            email,
            senha_hash: senhaHash,
            tipo_usuario: "CANDIDATO",
            status: "ATIVO",
            ultimo_login: new Date(),
          },
        });

        await tx.candidato.create({
          data: {
            id_usuario: user.id_usuario,
            cpf: cpfLimpo,
            turno_preferido: ["QUALQUER_TURNO"],
            cnh: ["NAO_POSSUO"],
            tipo_contato: ["WHATSAPP"],
            whatsapp: whatsapp || null,
          },
        });

        return user;
      },
    );

    const dadosToken = this.gerarToken(
      novoUsuario.id_usuario,
      novoUsuario.id_empresa,
      novoUsuario.tipo_usuario,
      novoUsuario.is_master,
      novoUsuario.exigir_troca_senha,
    );

    // 7. Retorna os dados do usuário junto com o token JWT
    return {
      usuario: {
        id: novoUsuario.id_usuario,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        tipo_usuario: novoUsuario.tipo_usuario,
      },
      ...dadosToken,
    };
  }

  async confirmarEmail(token: string) {
    // 1. Busca usando o novo campo do Prisma
    const usuario = await prisma.usuario.findUnique({
      where: { token_confirmar_email: token },
    });

    if (!usuario) {
      throw new Error("Link de confirmação inválido ou expirado.");
    }

    // 2. Atualiza apenas as flags de e-mail, mantendo o status intacto
    const usuarioAtualizado = await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        email_confirmado: true,
        token_confirmar_email: null, // Limpa o token após o uso
        // Se havia um e-mail pendente de troca, você pode opcionalmente aplicar aqui
        // caso esse método também seja usado para a troca de e-mails futuros.
      },
    });

    // 3. Retorna o token JWT. É uma boa prática manter isso, pois se o usuário
    // clicar no link do e-mail pelo celular, ele já cai logado no sistema!
    return this.gerarToken(
      usuarioAtualizado.id_usuario,
      usuarioAtualizado.id_empresa,
      usuarioAtualizado.tipo_usuario,
      usuarioAtualizado.is_master,
      usuarioAtualizado.exigir_troca_senha,
    );
  }

  async enviarLinkConfirmacao(email: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }

    // Validação usando a nova flag
    if (usuario.email_confirmado) {
      throw new Error("Este e-mail já está confirmado no sistema.");
    }

    // Gera um novo token seguro
    const novoToken = crypto.randomBytes(32).toString("hex");

    // Salva no banco no campo correto
    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { token_confirmar_email: novoToken },
    });

    console.log("📍 [3] Vai enfileirar no BullMQ");
    // Dispara o e-mail (Lembre-se de renomear no seu EmailService também)
    try {
      await emailService.enviarEmailConfirmacao(
        usuario.email,
        usuario.nome,
        novoToken,
      );
      console.log("📍 [4] Enfileirou com sucesso!");
    } catch (error) {
      console.error("Erro ao reenviar e-mail de confirmação:", error);
      throw new Error(
        "Não foi possível enfileirar o e-mail no momento. Tente novamente mais tarde.",
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
