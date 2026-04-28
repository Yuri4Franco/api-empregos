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

  async alterarSenha(id_usuario: number, senha_atual: string, nova_senha: string) {
    // 1. Busca o usuário no banco
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
    });

    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }

    // 2. Verifica se a senha atual confere com o Hash salvo (Atenção à ordem dos parâmetros no argon2)
    const senhaValida = await argon2.verify(usuario.senha_hash, senha_atual);
    if (!senhaValida) {
      throw new Error("A senha atual informada está incorreta.");
    }

    // 3. Regra de negócio: Não deixar colocar a mesma senha que já estava
    const isMesmaSenha = await argon2.verify(usuario.senha_hash, nova_senha);
    if (isMesmaSenha) {
      throw new Error("A nova senha não pode ser igual à senha atual.");
    }

    // 4. Criptografa a nova senha e salva no banco
    const novoHash = await argon2.hash(nova_senha);

    await prisma.usuario.update({
      where: { id_usuario },
      data: { 
        senha_hash: novoHash,
        exigir_troca_senha: false // Limpa o alerta de troca obrigatória, se existir
      },
    });

    return { message: "Senha alterada com sucesso!" };
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
