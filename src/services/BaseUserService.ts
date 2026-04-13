import { prisma } from "../config/prisma.js";
import argon2 from "argon2";

export class BaseUserService {
  // Centralizamos o log para reuso em todos os services
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

  async TrocarSenha(id_usuario: number, nova_senha: string, id_autor: number) {
    const senha_hash = await argon2.hash(nova_senha);
    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: { senha_hash, exigir_troca_senha: false },
      });

      await this.registrarLog(
        tx,
        id_autor,
        "TROCAR_SENHA",
        "Usuario",
        id_usuario,
      );

      return usuario;
    });
  }

  // Função única de atualização para a tabela 'Usuario'
  async atualizarUsuario(id_usuario: number, dados: any, id_autor: number) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id_usuario },
    });

    if (!usuarioExistente) throw new Error("Usuário não encontrado.");

    return await prisma.$transaction(async (tx) => {
      const dataUpdate: any = {};

      if (dados.nome) dataUpdate.nome = dados.nome;
      if (dados.email) dataUpdate.email = dados.email;
      if (dados.status) dataUpdate.status = dados.status;

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
        "ATUALIZAR_USUARIO_BASE",
        "Usuario",
        id_usuario,
        { campos_alterados: Object.keys(dataUpdate) },
      );

      return usuario;
    });
  }

  // Função genérica de status que atende Candidatos, Empresas e Admins
  async alterarStatus(
    id_usuario: number,
    novoStatus: "ATIVO" | "BLOQUEADO" | "INATIVO" | "PENDENTE",
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: {
          status: novoStatus,
          ...(novoStatus === "BLOQUEADO" && { data_exclusao: new Date() }),
        },
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

  // Busca completa com relacionamentos (Candidato/Empresa)
  async buscarPorId(id_usuario: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
      include: {
        empresa: {
          select: { id_empresa: true, nome_fantasia: true, cnpj: true },
        },
        candidato: {
          include: {
            experiencias: { orderBy: { data_inicio: "desc" } },
            formacoes: true,
            competencias: {
              include: { competencia: { select: { nome: true } } },
            },
          },
        },
        logs_admin: {
          take: 10,
          orderBy: { criado_em: "desc" },
        },
      },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");

    // Higienização de dados sensíveis
    const { senha_hash, ...dadosSeguros } = usuario;
    return dadosSeguros;
  }

  async obterPerfil(id_usuario: number) {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        tipo_usuario: true,
        exigir_troca_senha: true,
        // Trazemos a empresa se houver vínculo
        empresa: {
          select: {
            id_empresa: true,
            nome_fantasia: true,
            status: true,
            creditos_vagas: true,
            creditos_curriculos: true,
          },
        },
      },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");

    return usuario;
  }
}
