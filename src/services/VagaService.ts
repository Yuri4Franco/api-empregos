import { prisma } from "../config/prisma.js";
import { StatusVaga } from "@prisma/client";

export class VagaService {
  async criarVaga(dados: any, id_empresa: number, is_admin: boolean = false) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_vagas: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // Definição de Status conforme Escopo [cite: 19, 20]
    let statusFinal: StatusVaga = "RASCUNHO";
    if (is_admin)
      statusFinal = "ATIVA"; // Cadastro via Balcão vai direto
    else if (dados.enviar_para_aprovacao) statusFinal = "EM_ANALISE";

    // Lógica de Créditos para Não-Associados [cite: 33, 35]
    const consomeCredito =
      !is_admin &&
      empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
      statusFinal === "EM_ANALISE";

    if (consomeCredito && empresa.creditos_vagas <= 0) {
      throw new Error("Saldo de vagas insuficiente para publicação.");
    }

    return await prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.create({
        data: {
          id_empresa,
          titulo: dados.titulo,
          descricao: dados.descricao,
          requisitos_obrigatorios: dados.requisitos, // Alinhado ao schema
          beneficios: dados.beneficios,
          faixa_salarial_ate: dados.salario,
          tipo_contrato: dados.tipo_contrato,
          modelo_trabalho: dados.remoto ? "REMOTO" : "PRESENCIAL",
          area_profissional: dados.area_atuacao,
          nivel_hierarquico: dados.nivel_hierarquico,
          cidade: dados.cidade,
          uf: dados.uf,
          status: statusFinal,
          data_publicacao: statusFinal === "ATIVA" ? new Date() : null,
        },
      });

      // Cadastro de Etapas do Kanban [cite: 21]
      if (dados.etapas?.length > 0) {
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any, index: number) => ({
            id_vaga: vaga.id_vaga,
            nome: e.nome,
            ordem: e.ordem || index,
            tipo: e.tipo || "INTERMEDIARIA",
          })),
        });
      }

      // Débito de crédito após sucesso na criação [cite: 38]
      if (consomeCredito) {
        await tx.empresa.update({
          where: { id_empresa },
          data: { creditos_vagas: { decrement: 1 } },
        });
      }

      return vaga;
    });
  }

  async atualizarVaga(
    id_vaga: number,
    id_empresa_solicitante: number | null,
    dados: any,
    is_admin: boolean,
    id_autor: number,
  ) {
    // 1. Busca a vaga atual para verificar permissões
    const vagaAtual = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: { empresa: { select: { tipo_vinculo_aci: true } } },
    });

    if (!vagaAtual) throw new Error("Vaga não encontrada.");

    // 2. Trava de Segurança: Empresa não pode editar vaga de outra ou vaga já ATIVA
    if (!is_admin) {
      if (vagaAtual.id_empresa !== id_empresa_solicitante) {
        throw new Error("Você não tem permissão para editar esta vaga.");
      }

      // Conforme sua proposta: Se já estiver publicada/aceita, empresa não mexe
      if (vagaAtual.status === "ATIVA") {
        throw new Error(
          "Vagas já publicadas não podem ser editadas pela empresa. Contate o suporte da ACI.",
        );
      }
    }

    // 3. Definição do novo status
    let novoStatus = vagaAtual.status;
    if (!is_admin && dados.enviar_para_aprovacao) {
      novoStatus = "EM_ANALISE";
    }

    return await prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.update({
        where: { id_vaga },
        data: {
          titulo: dados.titulo,
          descricao: dados.descricao,
          requisitos_obrigatorios: dados.requisitos,
          beneficios: dados.beneficios,
          faixa_salarial_ate: dados.salario,
          tipo_contrato: dados.tipo_contrato,
          area_profissional: dados.area_atuacao,
          nivel_hierarquico: dados.nivel_hierarquico,
          cidade: dados.cidade,
          uf: dados.uf,
          status: novoStatus,
        },
      });

      // Se houver novas etapas, limpamos e recriamos (Sync)
      if (dados.etapas) {
        await tx.etapaProcesso.deleteMany({ where: { id_vaga } });
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any, index: number) => ({
            id_vaga,
            nome: e.nome,
            ordem: e.ordem ?? index,
            tipo: e.tipo,
          })),
        });
      }

      // Log de Auditoria (Escopo: Histórico de ações críticas [cite: 58])
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: is_admin ? "ADM_EDITAR_VAGA" : "EMPRESA_EDITAR_VAGA",
          entidade: "Vaga",
          id_entidade: id_vaga,
          detalhes: { campos: Object.keys(dados) },
        },
      });

      return vaga;
    });
  }

  async listarVagasPorEmpresa(id_empresa: number, filtros: any) {
    const { page, limit, search, status } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      id_empresa, // Trava de segurança obrigatória
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { titulo: { contains: search, mode: "insensitive" } },
                {
                  area_profissional: { contains: search, mode: "insensitive" },
                },
              ],
            }
          : {},
      ],
    };

    const [total, vagas] = await Promise.all([
      prisma.vaga.count({ where: onde }),
      prisma.vaga.findMany({
        where: onde,
        skip,
        take: limit,
        include: {
          _count: { select: { candidaturas: true } },
        },
        orderBy: { data_publicacao : "desc" },
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
        total_paginas: Math.ceil(total / limit),
      },
      data: vagas,
    };
  }

  async listarVagasPendentes() {
    return await prisma.vaga.findMany({
      where: { status: "EM_ANALISE" },
      include: {
        empresa: {
          select: { nome_fantasia: true, razao_social: true },
        },
      },
      orderBy: { id_vaga: "asc" },
    });
  }

  /**
   * Altera o status da vaga após revisão humana.
   * Se aprovada, ganha data de publicação.
   */
  async moderarVaga(id_vaga: number, novoStatus: "ATIVA" | "REPROVADA") {
    const vaga = await prisma.vaga.findUnique({ where: { id_vaga } });

    if (!vaga) throw new Error("Vaga não encontrada.");
    if (vaga.status !== "EM_ANALISE") {
      throw new Error(
        `Esta vaga não pode ser moderada pois seu status atual é ${vaga.status}`,
      );
    }

    return await prisma.vaga.update({
      where: { id_vaga },
      data: {
        status: novoStatus,
        data_publicacao: novoStatus === "ATIVA" ? new Date() : null,
        // Aqui poderíamos adicionar um campo 'motivo_reprovacao' no Model futuramente
      },
    });
  }

  async listarVagasPublicas(filtros: {
    cidade?: string;
    uf?: string;
    area?: string;
    modelo?: string;
    pagina?: number;
  }) {
    const itensPorPagina = 10;
    const skip = ((filtros.pagina || 1) - 1) * itensPorPagina;

    const where: any = {
      status: "ATIVA",
    };

    if (filtros.cidade) where.cidade = { contains: filtros.cidade };
    if (filtros.uf) where.uf = filtros.uf;
    if (filtros.area) where.area_profissional = filtros.area;
    if (filtros.modelo) where.modelo_trabalho = filtros.modelo;

    const [vagas, total] = await prisma.$transaction([
      prisma.vaga.findMany({
        where,
        select: {
          id_vaga: true,
          titulo: true,
          cidade: true,
          uf: true,
          area_profissional: true,
          modelo_trabalho: true,
          tipo_contrato: true,
          faixa_salarial_de: true,
          faixa_salarial_ate: true,
          ocultar_salario: true,
          empresa_confidencial: true, // ESTÁ AQUI: O campo pertence à Vaga
          data_publicacao: true,
          empresa: {
            select: {
              nome_fantasia: true,
              // Removido 'empresa_confidencial' daqui pois ele não existe no model Empresa
            },
          },
        },
        orderBy: { data_publicacao: "desc" },
        skip,
        take: itensPorPagina,
      }),
      prisma.vaga.count({ where }),
    ]);

    return {
      vagas,
      totalPaginas: Math.ceil(total / itensPorPagina),
      totalRegistros: total,
    };
  }

  async buscarPorId(id_vaga: number) {
    const vaga = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: {
        empresa: {
          select: {
            nome_fantasia: true,
            razao_social: true,
            // Adicione outros campos da empresa que achar relevante mostrar no detalhe
          },
        },
        beneficios: true, // Se houver relação com benefícios
        perguntas_eliminatorias: {
          include: {
            pergunta: true, // Para trazer o texto da pergunta cadastrada no banco
          },
        },
      },
    });

    if (!vaga) {
      throw new Error("Vaga não encontrada.");
    }

    // Se a vaga não estiver ativa, apenas o dono ou admin deveriam ver (lógica opcional)
    // Por enquanto, vamos retornar para permitir a visualização
    return vaga;
  }

  async listarCandidatosPorVaga(id_vaga: number, id_empresa: number) {
    // 1. Validar se a vaga pertence à empresa
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      select: { titulo: true },
    });

    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");

    // 2. Buscar as candidaturas com os dados dos candidatos e etapas
    const candidaturas = await prisma.candidatura.findMany({
      where: { id_vaga },
      include: {
        candidato: {
          include: {
            usuario: {
              select: { nome: true, email: true },
            },
          },
        },
        // Traz a descrição da etapa atual do candidato
        vaga: {
          select: {
            etapas: {
              where: {
                // Isso ajuda a mapear o nome da etapa no front
              },
            },
          },
        },
      },
      orderBy: { data_candidatura: "desc" },
    });

    return {
      vaga_titulo: vaga.titulo,
      candidatos: candidaturas.map((c) => ({
        id_candidatura: c.id_candidatura,
        id_candidato: c.id_candidato,
        nome: c.candidato.usuario.nome,
        cidade: c.candidato.cidade,
        uf: c.candidato.uf,
        status: c.status_atual,
        id_etapa_atual: c.id_etapa_atual,
        data_inscricao: c.data_candidatura,
      })),
    };
  }
}
