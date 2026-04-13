import { prisma } from "../config/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"; // Certifique-se de ter 'npm install bcrypt' e '@types/bcrypt'
import crypto from "node:crypto";

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

    return this.gerarToken(
      usuario.id_usuario,
      usuario.tipo_usuario,
      usuario.is_master,
      usuario.exigir_troca_senha
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
      usuarioPrincipal.exigir_troca_senha
    );
  }

  // #endregion FIM DAS FUNCIONALIDADES DE AUTENTICAÇÃO E GERAÇÃO DE TOKENS

  // #region FUNÇÃO AUXILIAR PARA GERAR TOKENS JWT
  private gerarToken(id_usuario: number, tipo: string, is_master: boolean, exigir_troca_senha: boolean  ) {
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

    // 1. Verificação de existência
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    // 2. Preparação de Segurança
    const senhaHash = await bcrypt.hash(senha, 10);
    const tokenAtivacao = crypto.randomBytes(32).toString("hex");

    // 3. Execução da Transação (Garante que cria Usuário E Candidato)
    return await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({
        data: {
          nome,
          email,
          senha_hash: senhaHash, // Nome exato do seu model [cite: 1]
          tipo_usuario: "CANDIDATO", // Usando o Enum ou String [cite: 31]
          status: "PENDENTE", // Status inicial conforme seu model
          token_ativacao: tokenAtivacao, // Adicionado ao schema
        },
      });

      // Criação do perfil do candidato (Seção 1 do escopo) [cite: 31, 94]
      await tx.candidato.create({
        data: {
          id_usuario: user.id_usuario,
          // Deixe o CPF como nulo/opcional no início conforme o fluxo simplificado [cite: 44]
        },
      });

      return {
        id: user.id_usuario,
        email: user.email,
        token: tokenAtivacao,
      };
    });
  }

  async confirmarEmail(token: string) {
    // 1. Busca o usuário pelo token de ativação [cite: 41, 42]
    const usuario = await prisma.usuario.findFirst({
      where: { token_ativacao: token },
    });

    if (!usuario) {
      throw new Error("Link de ativação inválido ou expirado.");
    }

    // 2. Ativa a conta e limpa o token
    return await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        status: "ATIVO",
        token_ativacao: null,
      },
    });
  }
}
