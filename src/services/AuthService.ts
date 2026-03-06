import { prisma } from "../config/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

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
      throw new Error("Verifique seu email e ative a sua conta. Contate a ACI.");
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
    );
  }

  // #endregion FIM DAS FUNCIONALIDADES DE AUTENTICAÇÃO E GERAÇÃO DE TOKENS
  
  // #region FUNÇÃO AUXILIAR PARA GERAR TOKENS JWT
  private gerarToken(id_usuario: number, tipo: string, is_master: boolean) {
    if (typeof JWT_SECRET !== "string") {
      throw new Error("Erro interno: JWT_SECRET não definida.");
    }

    const payload = {
      sub: id_usuario,
      role: tipo,
      master: is_master,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      ...(JWT_EXPIRES_IN
        ? { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
        : {}),
    } as jwt.SignOptions);

    return { token, tipo };
  }
  // #endregion FIM DA FUNÇÃO AUXILIAR PARA GERAR TOKENS JWT
}
