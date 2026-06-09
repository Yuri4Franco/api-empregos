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

  async alterarSenha(
    id_usuario: number,
    senha_atual: string,
    nova_senha: string,
  ) {
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
        exigir_troca_senha: false, // Limpa o alerta de troca obrigatória, se existir
      },
    });

    return { message: "Senha alterada com sucesso!" };
  }

  async definirSenhaInicial(id_usuario: number, nova_senha: string) {
    // 1. Busca o usuário
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");

    if (!usuario.exigir_troca_senha)
      throw new Error("Ação não permitida para este usuário.");

    const novoHash = await argon2.hash(nova_senha);

    await prisma.usuario.update({
      where: { id_usuario },
      data: {
        senha_hash: novoHash,
        exigir_troca_senha: false,
        status: "ATIVO", // Aproveitamos para garantir que o status mude para ATIVO
      },
    });

    return { message: "Senha definida com sucesso!" };
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
        empresa: {
          select: {
            id_empresa: true,
            nome_fantasia: true,
            status: true,
            creditos_vagas: true,
            creditos_curriculos: true,
            slug: true,
          },
        },
      },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");

    return usuario;
  }

  async excluirConta(id_usuario: number, senha_confirmacao: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
      include: { candidato: true, empresa: true },
    });

    if (!usuario) throw new Error("Usuário não encontrado.");
    if (usuario.status === "INATIVO") throw new Error("Conta já excluída.");

    const senhaValida = await argon2.verify(
      usuario.senha_hash,
      senha_confirmacao,
    );
    if (!senhaValida) {
      throw new Error("Senha incorreta. A exclusão não foi realizada.");
    }

    const hashExclusao = Date.now().toString();

    await prisma.$transaction(async (tx) => {
      if (usuario.tipo_usuario === "CANDIDATO" && usuario.candidato) {
        // 1. APAGA AS TABELAS RELACIONAIS (Hard Delete no que não afeta as métricas das empresas)
        await tx.experienciaProfissional.deleteMany({
          where: { id_candidato: id_usuario },
        });
        await tx.formacaoAcademica.deleteMany({
          where: { id_candidato: id_usuario },
        });
        await tx.candidatoCompetencia.deleteMany({
          where: { id_candidato: id_usuario },
        });
        await tx.candidatoAreaAtuacao.deleteMany({
          where: { id_candidato: id_usuario },
        });

        // 2. REMOVE O ENDEREÇO (Garante que a localização exata dele suma)
        if (usuario.candidato.id_endereco) {
          await tx.endereco.delete({
            where: { id_endereco: usuario.candidato.id_endereco },
          });
        }

        // 3. ANONIMIZA O PERFIL DO CANDIDATO (Destruição de Dados Pessoais)
        await tx.candidato.update({
          where: { id_usuario },
          data: {
            // Campos que aceitam Null: Esvaziamos todos para remover a identificação
            cpf: null,
            telefone: null,
            whatsapp: null,
            data_nascimento: null,
            foto_url: null,
            link_linkedin: null,
            link_portfolio: null,
            link_outro: null,
            objetivo_profissional: null,
            resumo_profissional: null,
            necessidade: null,
            tipo_pcd: null,
            genero: null,
            id_endereco: null,
            tipo_contato: { set: [] },

            // Campos que NÃO aceitam Null: Sanitizamos para o padrão inofensivo
            perfil_visivel_empresas: false,
            pcd: false,
            disponibilidade_viagem: false,
            disponibilidade_mudanca: false,
            disponibilidade_sabados: false,
            primeiro_emprego: false,
            turno_preferido: { set: [] }, // O Prisma exige o { set: [] } para limpar Arrays
            cnh: { set: [] },
          },
        });

        // 4. CANCELA AS CANDIDATURAS ATIVAS
        const candidaturasAtivas = await tx.candidatura.findMany({
          where: {
            id_candidato: id_usuario,
            status_atual: { notIn: ["REPROVADO", "DESISTENCIA", "APROVADO"] },
          },
        });

        for (const cand of candidaturasAtivas) {
          // Muda o status principal para Desistência
          await tx.candidatura.update({
            where: { id_candidatura: cand.id_candidatura },
            data: { status_atual: "DESISTENCIA" },
          });

          // Deixa o rastro transparente no histórico do Recrutador lá na vaga
          await tx.movimentoCandidatura.create({
            data: {
              id_candidatura: cand.id_candidatura,
              etapa_destino: cand.id_etapa_atual,
              status_destino: "DESISTENCIA",
              motivo:
                "O candidato excluiu sua conta permanentemente na plataforma ACI Vagas.",
            },
          });
        }
      }

      // ==========================================
      // FLUXO B: EXCLUSÃO DE EMPRESA (PJ - CONGELAMENTO)
      // ==========================================
      else if (usuario.tipo_usuario === "EMPRESA" && usuario.id_empresa) {
        // Se for o dono (master) da empresa excluindo a conta, nós congelamos a empresa inteira
        if (usuario.is_master) {
          // 1. Inativa a Empresa (O perfil e o logo dela saem do ar)
          await tx.empresa.update({
            where: { id_empresa: usuario.id_empresa },
            data: { status: "INATIVO" },
          });

          // 2. Força o encerramento de todas as vagas abertas (Impede novas candidaturas)
          await tx.vaga.updateMany({
            where: {
              id_empresa: usuario.id_empresa,
              status: { in: ["ATIVA", "EM_ANALISE", "RASCUNHO", "PAUSADA"] },
            },
            data: { status: "ENCERRADA" },
          });
        }
      }

      // ==========================================
      // GOLPE FINAL: ANONIMIZA O USUÁRIO BASE
      // (Serve tanto para o Login do Candidato quanto do Recrutador)
      // ==========================================
      await tx.usuario.update({
        where: { id_usuario },
        data: {
          nome: "Usuário Excluído",
          email: `excluido_${id_usuario}_${hashExclusao}@acivagas.com`, // Fica irreconhecível, mas mantém a regra UNIQUE
          senha_hash: "DELETED", // Destrói o hash da senha
          token_ativacao: null,
          token_recuperar: null,
          is_master: false, // Remove privilégios
          status: "INATIVO",
          data_exclusao: new Date(),
        },
      });
    });

    return {
      message:
        "Conta e dados relacionados foram removidos ou inativados com sucesso.",
    };
  }
}
