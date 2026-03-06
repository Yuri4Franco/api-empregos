import { prisma } from "../config/prisma.js";
import argon2 from "argon2";

export class BaseUserService {
  // Método privado para padronizar logs de auditoria em todo o sistema
  async registrarLog(
    tx: any,
    id_autor: number,
    acao: string,
    entidade: string,
    id_entidade: number,
    detalhes?: any,
  ) {
    await tx.logAuditoria.create({
      data: {
        id_usuario: id_autor,
        acao,
        entidade,
        id_entidade,
        detalhes: detalhes || {},
      },
    });
  }

  // Atualização genérica de qualquer tipo de usuário
  async atualizarDadosBasicos(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const dataUpdate: any = {
        nome: dados.nome,
        email: dados.email,
        status: dados.status,
      };

      if (dados.senha) {
        dataUpdate.senha_hash = await argon2.hash(dados.senha);
        dataUpdate.exigir_troca_senha = true;
      }

      // Limpa campos undefined para o Prisma
      Object.keys(dataUpdate).forEach(
        (key) => dataUpdate[key] === undefined && delete dataUpdate[key],
      );

      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: dataUpdate,
      });

      await this.registrarLog(
        tx,
        id_autor,
        "ATUALIZAR_USUARIO_BASE",
        "Usuario",
        id_usuario,
        {
          campos: Object.keys(dataUpdate),
        },
      );

      return usuario;
    });
  }

  async alterarStatus(
    id_usuario: number,
    novoStatus: "ATIVO" | "BLOQUEADO" | "INATIVO",
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: { status: novoStatus },
      });

      await this.registrarLog(
        tx,
        id_autor,
        `ALTERAR_STATUS_USUARIO_${novoStatus}`,
        "Usuario",
        id_usuario,
      );

      return usuario;
    });
  }

  async atualizarUsuario(id_usuario: number, dados: any, id_autor: number) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuarioExistente) throw new Error("Usuário não encontrado.");

    return await prisma.$transaction(async (tx) => {
      const dataUpdate: any = {};

      if (dados.nome) dataUpdate.nome = dados.nome;
      if (dados.email) dataUpdate.email = dados.email;
      if (dados.senha) {
        dataUpdate.senha_hash = await argon2.hash(dados.senha);
        dataUpdate.exigir_troca_senha = true;
      }

      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: dataUpdate,
      });

      await this.registrarLog(
        tx,
        id_autor,
        "ATUALIZAR_USUARIO",
        "Usuario",
        id_usuario,
        {
          campos_alterados: Object.keys(dataUpdate),
        },
      );

      return usuario;
    });
  }

  async buscarPorId(id_usuario: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
      include: {
        empresa: {
          select: { id_empresa: true, nome_fantasia: true, cnpj: true },
        },
        // Aqui entra a mágica: Traz o perfil do candidato se existir
        candidato: {
          include: {
            experiencias: true, // Já traz o currículo junto
            formacoes: true,
            competencias: true,
          },
        },
        logs_admin: {
          take: 10,
          orderBy: { criado_em: "desc" },
        },
      },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");

    const { senha_hash, ...dadosSeguros } = usuario;
    return dadosSeguros;
  }
}
