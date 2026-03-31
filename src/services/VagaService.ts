import { prisma } from "../config/prisma.js";
import { ModeloTrabalho, StatusVaga } from "@prisma/client";

export class VagaService {
  async criarVaga(dados: any, id_empresa: number, is_admin: boolean = false) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_vagas: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // 1. Definição de Status conforme Escopo [cite: 151, 205]
    let statusFinal: StatusVaga = "RASCUNHO";
    if (is_admin) {
      statusFinal = "ATIVA"; // Cadastro via Balcão [cite: 14]
    } else if (dados.enviar_para_aprovacao) {
      // Se for Não-Associada e não tiver pago, cai em aguardando pagamento [cite: 322, 328]
      statusFinal =
        empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
        empresa.creditos_vagas <= 0
          ? "AGUARDANDO_PAGAMENTO"
          : "EM_ANALISE";
    }

    return await prisma.$transaction(async (tx) => {
      // 2. Criar o Endereço (Vaga pode ter endereço próprio ou da empresa) [cite: 171]
      const endereco = await tx.endereco.create({
        data: {
          logradouro: dados.logradouro,
          numero: dados.numero,
          cidade: dados.cidade || "Panambi",
          uf: dados.uf || "RS",
          id_bairro: dados.id_bairro,
        },
      });

      // 3. Criar a Vaga Base (Etapa 1 e 2 do Wizard) [cite: 165, 177]
      const vaga = await tx.vaga.create({
        data: {
          id_empresa,
          id_endereco: endereco.id_endereco,
          id_area_atuacao: dados.id_area_atuacao,
          titulo: dados.titulo,
          nivel_hierarquico: dados.nivel_hierarquico,
          modelo_trabalho: dados.modelo_trabalho, // PRESENCIAL, HIBRIDO, REMOTO [cite: 172]
          tipo_contrato: dados.tipo_contrato, // CLT, PJ, etc [cite: 172]
          faixa_salarial_de: dados.salario_de,
          faixa_salarial_ate: dados.salario_ate,
          salario_a_combinar: dados.salario_a_combinar || false,
          ocultar_salario: dados.ocultar_salario || false,
          descricao: dados.descricao,
          responsabilidades: dados.responsabilidades,
          requisitos_obrigatorios: dados.requisitos_obrigatorios,
          diferenciais: dados.diferenciais,
          empresa_confidencial: dados.empresa_confidencial || false,
          status: statusFinal,
          data_publicacao: statusFinal === "ATIVA" ? new Date() : null,
        },
      });

      // 4. Vincular Benefícios (Etapa 2 - Biblioteca + Extras) [cite: 182, 183]
      if (dados.beneficios_ids?.length > 0) {
        await tx.vagaBeneficio.createMany({
          data: dados.beneficios_ids.map((id_ben: number) => ({
            id_vaga: vaga.id_vaga,
            id_beneficio: id_ben,
          })),
        });
      }

      // 5. Configurar Triagem: Perguntas Eliminatórias (Etapa 3) [cite: 185, 186]
      if (dados.perguntas_eliminatorias?.length > 0) {
        await tx.vagaPerguntaEliminatoria.createMany({
          data: dados.perguntas_eliminatorias.map((p: any) => ({
            id_vaga: vaga.id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }

      // 6. Configurar Etapas do Kanban (Etapa 3) [cite: 191, 194]
      // Se não enviar nada, cria o padrão: Triagem > Entrevista > Oferta [cite: 193]
      const etapasPadrao = [
        { nome_etapa: "Inscritos", ordem: 0, tipo: "INICIAL" },
        { nome_etapa: "Triagem", ordem: 1, tipo: "INTERMEDIARIA" },
        {
          nome_etapa: "Entrevista",
          ordem: 2,
          tipo: "INTERMEDIARIA",
          requer_agendamento: true,
        },
        { nome_etapa: "Finalistas", ordem: 3, tipo: "FINAL" },
      ];

      const etapasParaCriar =
        dados.etapas?.length > 0 ? dados.etapas : etapasPadrao;

      await tx.etapaProcesso.createMany({
        data: etapasParaCriar.map((e: any, idx: number) => ({
          id_vaga: vaga.id_vaga,
          nome_etapa: e.nome_etapa || e.nome,
          ordem: e.ordem !== undefined ? e.ordem : idx,
          tipo: e.tipo || "INTERMEDIARIA",
          requer_agendamento: e.requer_agendamento || false,
        })),
      });

      // 7. Consumo de Créditos (Apenas se for publicada/enviada para análise) [cite: 322, 329]
      if (
        statusFinal === "EM_ANALISE" &&
        empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
        !is_admin
      ) {
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
    id_empresa: number | null, // Admin passa null para ignorar trava de dono
    dados: any,
    is_admin: boolean = false, // Flag para pular validações de rascunho
    id_autor?: number, // Para o log de auditoria do Admin
  ) {
    // 1. Buscar a vaga e o endereço atual
    const vagaExistente = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: { endereco: true },
    });

    if (!vagaExistente) throw new Error("Vaga não encontrada.");

    // 2. Trava de Segurança: Se NÃO for admin, obriga ser o dono da empresa
    if (!is_admin && vagaExistente.id_empresa !== id_empresa) {
      throw new Error(
        "Acesso negado: Você não tem permissão para editar esta vaga.",
      );
    }

    return await prisma.$transaction(async (tx) => {
      // 3. Atualizar Endereço (Normalizado)
      // 3. Atualizar Endereço (Normalizado)
      if (vagaExistente.id_endereco) {
        // Criamos um objeto apenas com o que realmente veio para evitar o erro de 'undefined'
        const dadosEndereco: any = {};

        if (dados.logradouro !== undefined)
          dadosEndereco.logradouro = dados.logradouro;
        if (dados.numero !== undefined) dadosEndereco.numero = dados.numero;
        if (dados.cidade !== undefined) dadosEndereco.cidade = dados.cidade;

        // Para chaves estrangeiras no Prisma Update, usamos o valor direto
        if (dados.id_bairro !== undefined) {
          dadosEndereco.id_bairro = dados.id_bairro
            ? Number(dados.id_bairro)
            : null;
        }

        await tx.endereco.update({
          where: { id_endereco: vagaExistente.id_endereco },
          data: dadosEndereco,
        });
      }
      // 4. Determinar novo Status
      // Admin pode forçar status "ATIVA" direto ou manter o que foi enviado
      let novoStatus = vagaExistente.status;
      if (is_admin && dados.status) {
        novoStatus = dados.status;
      } else if (dados.enviar_para_aprovacao) {
        novoStatus = "EM_ANALISE";
      }

      // 5. Atualizar a Vaga (Limpando Undefineds)
      const dadosVaga: any = {};

      // Mapeamento de campos simples
      const campos = [
        "titulo",
        "nivel_hierarquico",
        "modelo_trabalho",
        "tipo_contrato",
        "faixa_salarial_de",
        "faixa_salarial_ate",
        "salario_a_combinar",
        "ocultar_salario",
        "descricao",
        "responsabilidades",
        "requisitos_obrigatorios",
        "diferenciais",
        "empresa_confidencial",
      ];

      campos.forEach((campo) => {
        if (dados[campo] !== undefined) dadosVaga[campo] = dados[campo];
      });

      // Tratamento especial para IDs e Status
      if (dados.id_area_atuacao !== undefined)
        dadosVaga.id_area_atuacao = Number(dados.id_area_atuacao);
      if (novoStatus !== undefined) dadosVaga.status = novoStatus;

      // Tratamento para data_publicacao
      if (novoStatus === "ATIVA" && !vagaExistente.data_publicacao) {
        dadosVaga.data_publicacao = new Date();
      }

      const vaga = await tx.vaga.update({
        where: { id_vaga },
        data: dadosVaga,
      });

      // 6. Sincronizar Etapas (CRUD completo das colunas do Kanban)
      if (dados.etapas && Array.isArray(dados.etapas)) {
        await tx.etapaProcesso.deleteMany({ where: { id_vaga } });
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any, idx: number) => ({
            id_vaga,
            nome_etapa: e.nome_etapa || e.nome,
            ordem: e.ordem ?? idx,
            tipo: e.tipo || "INTERMEDIARIA",
            requer_agendamento: e.requer_agendamento || false,
          })),
        });
      }

      // 5.1. Sincronizar Benefícios (Etapa 2 - Biblioteca [cite: 182, 183])
      if (dados.beneficios_ids && Array.isArray(dados.beneficios_ids)) {
        // Limpa os vínculos antigos daquela vaga
        await tx.vagaBeneficio.deleteMany({ where: { id_vaga } });

        // Cria os novos vínculos com a tabela de Taxonomia de Benefícios
        await tx.vagaBeneficio.createMany({
          data: dados.beneficios_ids.map((id_ben: number) => ({
            id_vaga,
            id_beneficio: id_ben,
          })),
        });
      }

      // 5.2. Sincronizar Perguntas Eliminatórias (Etapa 3 [cite: 185, 186])
      if (
        dados.perguntas_eliminatorias &&
        Array.isArray(dados.perguntas_eliminatorias)
      ) {
        // Remove as configurações de triagem anteriores
        await tx.vagaPerguntaEliminatoria.deleteMany({ where: { id_vaga } });

        // Insere as novas perguntas e as respostas esperadas
        await tx.vagaPerguntaEliminatoria.createMany({
          data: dados.perguntas_eliminatorias.map((p: any) => ({
            id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }

      // 7. Auditoria Crítica (Exigência do Escopo Admin [cite: 56, 58])
      if (is_admin && id_autor) {
        await tx.logAuditoria.create({
          data: {
            id_usuario: id_autor,
            acao: "ADM_EDITAR_VAGA",
            entidade: "Vaga",
            id_entidade: id_vaga,
            detalhes: { alterado_por: id_autor, data: new Date() },
          },
        });
      }

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
