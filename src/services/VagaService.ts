import { prisma } from "../config/prisma.js";
import { ModeloTrabalho, StatusVaga } from "@prisma/client";

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
      statusFinal = "ATIVA"; // Cadastro via Balcão [cite: 14]
    else if (dados.enviar_para_aprovacao) statusFinal = "EM_ANALISE";

    // Lógica de Créditos para Não-Associados [cite: 33, 35, 38]
    const consomeCredito =
      !is_admin &&
      empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
      statusFinal === "EM_ANALISE";

    if (consomeCredito && empresa.creditos_vagas <= 0) {
      throw new Error("Saldo de vagas insuficiente para publicação.");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Criar o Endereço primeiro (Nova Regra de Negócio)
      const endereco = await tx.endereco.create({
        data: {
          logradouro: dados.logradouro,
          numero: dados.numero,
          cidade: dados.cidade || "Panambi",
          uf: dados.uf || "RS",
          id_bairro: dados.id_bairro, // Agora usa o ID da Taxonomia
        },
      });

      const vaga = await tx.vaga.create({
        data: {
          id_empresa,
          id_endereco: endereco.id_endereco,
          id_area_atuacao: dados.id_area_atuacao,
          titulo: dados.titulo,
          descricao: dados.descricao,
          requisitos_obrigatorios: dados.requisitos,
          beneficios: dados.beneficios,
          faixa_salarial_ate: dados.salario,
          tipo_contrato: dados.tipo_contrato,
          modelo_trabalho: dados.remoto ? "REMOTO" : "PRESENCIAL",
          nivel_hierarquico: dados.nivel_hierarquico,
          status: statusFinal,
          data_publicacao: statusFinal === "ATIVA" ? new Date() : null,
        },
      });
      if (dados.etapas?.length > 0) {
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any, index: number) => ({
            id_vaga: vaga.id_vaga,
            nome_etapa: e.nome,
            ordem: e.ordem || index,
            tipo: e.tipo || "INTERMEDIARIA",
          })),
        });
      }

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
    // 1. Busca a vaga atual com as relações necessárias para conferência
    const vagaAtual = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: {
        empresa: { select: { tipo_vinculo_aci: true } },
        endereco: true, // Precisamos do ID do endereço para atualizar
      },
    });

    if (!vagaAtual) throw new Error("Vaga não encontrada.");

    // 2. Trava de Segurança [cite: 12]
    if (!is_admin) {
      if (vagaAtual.id_empresa !== id_empresa_solicitante) {
        throw new Error("Você não tem permissão para editar esta vaga.");
      }

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
      // 4. Atualizar o Endereço vinculado (Se os dados forem enviados)
      if (vagaAtual.id_endereco) {
        await tx.endereco.update({
          where: { id_endereco: vagaAtual.id_endereco },
          data: {
            logradouro: dados.logradouro,
            numero: dados.numero,
            cidade: dados.cidade,
            uf: dados.uf,
            id_bairro: dados.id_bairro, // Taxonomia de Bairros
          },
        });
      }

      // 5. Atualizar a Vaga (Corrigindo os nomes dos campos conforme o Schema)
      const vaga = await tx.vaga.update({
        where: { id_vaga },
        data: {
          titulo: dados.titulo,
          descricao: dados.descricao,
          requisitos_obrigatorios: dados.requisitos,
          faixa_salarial_ate: dados.salario,
          tipo_contrato: dados.tipo_contrato,
          id_area_atuacao: dados.id_area_atuacao,
          nivel_hierarquico: dados.nivel_hierarquico,
          status: novoStatus,
        },
      });

      if (dados.id_beneficios) {
        await tx.vagaBeneficio.deleteMany({ where: { id_vaga } });
        await tx.vagaBeneficio.createMany({
          data: dados.id_beneficios.map((id_ben: number) => ({
            id_vaga,
            id_beneficio: id_ben,
          })),
        });
      }

      // 7. Sincronizar Etapas
      if (dados.etapas) {
        await tx.etapaProcesso.deleteMany({ where: { id_vaga } });
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any, index: number) => ({
            id_vaga,
            nome_etapa: e.nome, // Nome correto do campo no seu Schema
            ordem: e.ordem ?? index,
            tipo: e.tipo,
          })),
        });
      }

      // 8. Log de Auditoria Crítica [cite: 56, 58]
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: is_admin ? "ADM_EDITAR_VAGA" : "EMPRESA_EDITAR_VAGA",
          entidade: "Vaga",
          id_entidade: id_vaga,
          detalhes: { campos_alterados: Object.keys(dados) },
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
        orderBy: { data_publicacao: "desc" },
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

  async listarVagasPendentes(filtros: any) {
    const { page = 1, limit = 10, search } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      status: "EM_ANALISE", // Filtro fixo da fila de aprovação
      AND: [
        search
          ? {
              OR: [
                { titulo: { contains: search, mode: "insensitive" } },
                {
                  empresa: {
                    nome_fantasia: { contains: search, mode: "insensitive" },
                  },
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
          empresa: {
            select: {
              nome_fantasia: true,
              tipo_vinculo_aci: true,
              cnpj: true,
            },
          },
        },
        orderBy: { data_publicacao: "asc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: vagas,
    };
  }

  /**
   * Altera o status da vaga após revisão humana.
   * Se aprovada, ganha data de publicação.
   */
  async moderarVaga(
    id_vaga: number,
    novoStatus: "ATIVA" | "REPROVADA",
    motivo: string | null,
    id_autor: number,
  ) {
    const vaga = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: {
        empresa: { select: { id_empresa: true, tipo_vinculo_aci: true } },
      },
    });

    if (!vaga) throw new Error("Vaga não encontrada.");
    if (vaga.status !== "EM_ANALISE") {
      throw new Error(
        `Esta vaga não pode ser moderada pois seu status atual é ${vaga.status}`,
      );
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Atualiza a vaga
      const vagaAtualizada = await tx.vaga.update({
        where: { id_vaga },
        data: {
          status: novoStatus,
          data_publicacao: novoStatus === "ATIVA" ? new Date() : null,
          observacoes_admin: motivo, // Usando o campo de observações para o motivo
        },
      });

      // 2. Lógica de Estorno: Se reprovada e for empresa não-associada, devolve 1 crédito
      if (
        novoStatus === "REPROVADA" &&
        vaga.empresa.tipo_vinculo_aci === "NAO_ASSOCIADA"
      ) {
        await tx.empresa.update({
          where: { id_empresa: vaga.id_empresa },
          data: { creditos_vagas: { increment: 1 } },
        });
      }

      // 3. Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: novoStatus === "ATIVA" ? "APROVAR_VAGA" : "REPROVAR_VAGA",
          entidade: "Vaga",
          id_entidade: id_vaga,
          detalhes: { motivo },
        },
      });

      return vagaAtualizada;
    });
  }

  async listarVagasPublicas(filtros: {
    id_bairro?: number; // Agora filtramos pelo ID da Taxonomia
    cidade?: string;
    uf?: string;
    id_area_atuacao?: number; // Filtro por ID para precisão no BI
    modelo?: ModeloTrabalho;
    pagina?: number;
  }) {
    const itensPorPagina = 10;
    const skip = ((filtros.pagina || 1) - 1) * itensPorPagina;

    // Construção do Filtro com as novas relações
    const where: any = {
      status: "ATIVA", // Apenas o que o Admin aprovou [cite: 20]
      AND: [
        // Filtro de Localização (dentro da tabela Endereco)
        filtros.cidade || filtros.uf || filtros.id_bairro
          ? {
              endereco: {
                is: {
                  ...(filtros.cidade && {
                    cidade: { contains: filtros.cidade, mode: "insensitive" },
                  }),
                  ...(filtros.uf && { uf: filtros.uf }),
                  ...(filtros.id_bairro && { id_bairro: filtros.id_bairro }),
                },
              },
            }
          : {},
        // Filtro de Área (Taxonomia)
        filtros.id_area_atuacao
          ? { id_area_atuacao: filtros.id_area_atuacao }
          : {},
        // Filtro de Modelo
        filtros.modelo ? { modelo_trabalho: filtros.modelo } : {},
      ],
    };

    const [vagas, total] = await prisma.$transaction([
      prisma.vaga.findMany({
        where,
        select: {
          id_vaga: true,
          titulo: true,
          modelo_trabalho: true,
          tipo_contrato: true,
          faixa_salarial_de: true,
          faixa_salarial_ate: true,
          ocultar_salario: true,
          empresa_confidencial: true,
          data_publicacao: true,
          // Buscando dados do Endereço normalizado
          endereco: {
            select: {
              cidade: true,
              uf: true,
              bairro: { select: { nome: true } },
            },
          },
          // Buscando nome da Área da Taxonomia
          area_atuacao: {
            select: { nome: true },
          },
          empresa: {
            select: {
              nome_fantasia: true,
              logotipo_url: true,
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
          },
        },
        beneficios: true,
        perguntas_eliminatorias: {
          include: {
            pergunta: true,
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

    // 2. Buscar as candidaturas com os dados normalizados
    const candidaturas = await prisma.candidatura.findMany({
      where: { id_vaga },
      include: {
        candidato: {
          include: {
            usuario: {
              select: { nome: true, email: true },
            },
            // Buscamos o endereço normalizado para pegar cidade/uf
            endereco: {
              include: {
                bairro: { select: { nome: true } }, // Para o BI e localização
              },
            },
            // Buscamos a área de atuação do candidato
            area_atuacao: { select: { nome: true } },
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
        email: c.candidato.usuario.email,
        // Acessamos cidade e UF através do objeto endereco
        cidade: c.candidato.endereco?.cidade || "Não informada",
        uf: c.candidato.endereco?.uf || "--",
        bairro: c.candidato.endereco?.bairro?.nome || "Outro/Não informado",
        area_profissional: c.candidato.area_atuacao?.nome || "Não definida",
        status: c.status_atual,
        id_etapa_atual: c.id_etapa_atual,
        data_inscricao: c.data_candidatura,
      })),
    };
  }
}
