import { prisma } from "../config/prisma.js";
import { ModeloTrabalho, StatusVaga } from "@prisma/client";

export class VagaService {
  async criarVaga(dados: any, id_empresa: number, is_admin: boolean = false) {

    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_vagas: true },
    });

    if (!empresa) throw new Error("Em presa não encontrada.");

    let statusFinal: StatusVaga = "RASCUNHO";
    if (is_admin) {
      statusFinal = "ATIVA";
    } else if (dados.enviar_para_aprovacao) {
      statusFinal =
        empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
        empresa.creditos_vagas <= 0
          ? "AGUARDANDO_PAGAMENTO"
          : "EM_ANALISE";
    }

    return await prisma.$transaction(async (tx) => {
      const endereco = await tx.endereco.create({
        data: {
          logradouro: dados.logradouro || "",
          numero: dados.numero || "",
          cidade: dados.cidade || "Panambi",
          uf: dados.uf || "RS",
          bairro: dados.bairro || "",
        },
      });

      const vaga = await tx.vaga.create({
        data: {
          empresa: { connect: { id_empresa: id_empresa } },
          endereco: { connect: { id_endereco: endereco.id_endereco } },

          ...(dados.id_area_atuacao
            ? { area_atuacao: { connect: { id_area: dados.id_area_atuacao } } }
            : {}),

          titulo: dados.titulo,
          nivel_hierarquico: dados.nivel_hierarquico || "NAO_INFORMADO",
          tipo_diversidade: dados.tipo_diversidade || "AMPLA_CONCORRENCIA",
          modelo_trabalho: dados.modelo_trabalho || "PRESENCIAL",
          tipo_contrato: dados.tipo_contrato || "CLT",

          faixa_salarial_de: dados.salario_de || null,
          faixa_salarial_ate: dados.salario_ate || null,

          salario_a_combinar: dados.salario_a_combinar || false,
          ocultar_salario: dados.ocultar_salario || false,
          descricao: dados.descricao || "",
          responsabilidades: dados.responsabilidades || "",
          requisitos_obrigatorios: dados.requisitos_obrigatorios || "",
          diferenciais: dados.diferenciais || "",
          empresa_confidencial: dados.empresa_confidencial || false,
          status: statusFinal,
          data_encerramento: dados.data_encerramento ? new Date(dados.data_encerramento) : null,
          
          vaga_externa: dados.vaga_externa || false,    
          link_externo: dados.link_externo || null,         
          instrucoes_candidatura: dados.instrucoes_candidatura || null,


          data_publicacao: statusFinal === "ATIVA" ? new Date() : new Date(),
        },
      });

      // Se for rascunho, essas listas podem vir vazias ou undefined, o '?' protege o código
      if (dados.beneficios_ids?.length > 0) {
        await tx.vagaBeneficio.createMany({
          data: dados.beneficios_ids.map((id_ben: number) => ({
            id_vaga: vaga.id_vaga,
            id_beneficio: id_ben,
          })),
        });
      }

      if (dados.perguntas_eliminatorias?.length > 0) {
        await tx.vagaPerguntaEliminatoria.createMany({
          data: dados.perguntas_eliminatorias.map((p: any) => ({
            id_vaga: vaga.id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }

      // Se o usuário não enviou etapas no rascunho, não criamos as padrão ainda, ou criamos as básicas
      const etapasPadrao = [
        { nome_etapa: "Inscritos", requer_agendamento: false },
        { nome_etapa: "Entrevista", requer_agendamento: true },
        { nome_etapa: "Finalistas", requer_agendamento: false },
      ];
      

      const etapasParaCriar =
        dados.etapas?.length > 0 ? dados.etapas : etapasPadrao;
      const totalEtapas = etapasParaCriar.length;

      await tx.etapaProcesso.createMany({
        data: etapasParaCriar.map((e: any, idx: number) => {
          let tipoSeguro = "INTERMEDIARIA";
          if (idx === 0) tipoSeguro = "INICIAL";
          else if (idx === totalEtapas - 1) tipoSeguro = "FINAL";

          return {
            id_vaga: vaga.id_vaga,
            nome_etapa: e.nome_etapa || e.nome,
            ordem: idx,
            tipo: tipoSeguro,
            requer_agendamento: e.requer_agendamento || false,
          };
        }),
      });

      await tx.configuracaoVaga.create({
        data: {
          id_vaga: vaga.id_vaga,
          campos_destaque: [
            "foto",
            "nome",
            "idade",
            "experiencia_recente",
            "cidade",
          ],
        },
      });

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

  async listarTodasVagasAdmin(filtros: {
    busca?: string | undefined;
    status?: string | undefined;
    id_empresa?: number | undefined;
    pagina?: number | undefined;
    limite?: number | undefined;
  }) {
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 10;
    const skip = (pagina - 1) * limite;

    // Constrói a cláusula WHERE dinamicamente
    const whereClause: any = {
      AND: [], // Usamos AND para combinar múltiplos filtros
    };

    // 1. Filtro Exato por Status (ex: ATIVA, PAUSADA, PREENCHIDA)
    if (filtros.status) {
      whereClause.AND.push({ status: filtros.status });
    }

    // 2. Filtro Exato por Empresa (útil se o admin clicar em "Ver vagas desta empresa")
    if (filtros.id_empresa) {
      whereClause.AND.push({ id_empresa: filtros.id_empresa });
    }

    // 3. Busca em Texto Aberto (Procura no Título da Vaga OU no Nome da Empresa)
    if (filtros.busca) {
      whereClause.AND.push({
        OR: [
          { titulo: { contains: filtros.busca, mode: "insensitive" } },
          {
            empresa: {
              nome_fantasia: { contains: filtros.busca, mode: "insensitive" },
            },
          },
          {
            empresa: {
              razao_social: { contains: filtros.busca, mode: "insensitive" },
            },
          },
        ],
      });
    }

    // Se o array AND ficar vazio, deletamos para não quebrar o Prisma
    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    // Busca Paralela para Performance (Conta o total e busca a página ao mesmo tempo)
    const [totalVagas, vagas] = await Promise.all([
      prisma.vaga.count({ where: whereClause }),

      prisma.vaga.findMany({
        where: whereClause,
        skip: skip,
        take: limite,
        orderBy: {
          data_publicacao: "desc", // Vagas mais recentes no topo
        },
        include: {
          empresa: {
            select: {
              id_empresa: true,
              nome_fantasia: true,
              cnpj: true,
            },
          },
          area_atuacao: {
            select: { nome: true },
          },

          _count: {
            select: { candidaturas: true },
          },
        },
      }),
    ]);

    return {
      dados: vagas,
      paginacao: {
        total: totalVagas,
        pagina_atual: pagina,
        total_paginas: Math.ceil(totalVagas / limite),
      },
    };
  }

  async duplicarVaga(id_vaga: number, id_empresa: number) {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.vaga.findFirst({
        where: { id_vaga, id_empresa },
        include: {
          endereco: true,
          beneficios: true,
          etapas: { orderBy: { ordem: "asc" } },
          perguntas_eliminatorias: true,
          competencias: true,
          configuracao: true,
        },
      });

      if (!original)
        throw new Error("Vaga original não encontrada ou acesso negado.");
      
      const novoEndereco = original.endereco
        ? await tx.endereco.create({
            data: {
              logradouro: original.endereco.logradouro,
              numero: original.endereco.numero,
              complemento: original.endereco.complemento,
              cep: original.endereco.cep,
              cidade: original.endereco.cidade,
              uf: original.endereco.uf,
              bairro: original.endereco.bairro,
            },
          })
        : null;

      const novaVaga = await tx.vaga.create({
       data: {
          id_empresa: original.id_empresa,
          titulo: original.titulo,
          nivel_hierarquico: original.nivel_hierarquico,
          id_endereco: novoEndereco?.id_endereco ?? null,
          modelo_trabalho: original.modelo_trabalho,
          tipo_contrato: original.tipo_contrato,
          faixa_salarial_de: original.faixa_salarial_de,
          faixa_salarial_ate: original.faixa_salarial_ate,
          salario_a_combinar: original.salario_a_combinar,
          ocultar_salario: original.ocultar_salario,
          descricao: original.descricao,
          responsabilidades: original.responsabilidades,
          requisitos_obrigatorios: original.requisitos_obrigatorios,
          diferenciais: original.diferenciais,
          empresa_confidencial: original.empresa_confidencial,
          id_area_atuacao: original.id_area_atuacao,
          tipo_diversidade: original.tipo_diversidade, 
          status: "RASCUNHO", 
        },
      });
      if (original.beneficios.length > 0) {
        await tx.vagaBeneficio.createMany({
          data: original.beneficios.map((b) => ({
            id_vaga: novaVaga.id_vaga,
            id_beneficio: b.id_beneficio,
          })),
        });
      }
      if (original.perguntas_eliminatorias.length > 0) {
        await tx.vagaPerguntaEliminatoria.createMany({
          data: original.perguntas_eliminatorias.map((p) => ({
            id_vaga: novaVaga.id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }
      if (original.etapas.length > 0) {
        await tx.etapaProcesso.createMany({
          data: original.etapas.map((e) => ({
            id_vaga: novaVaga.id_vaga,
            nome_etapa: e.nome_etapa,
            ordem: e.ordem,
            tipo: e.tipo,
            requer_agendamento: e.requer_agendamento,
          })),
        });
      }
      if (original.configuracao) {
        await tx.configuracaoVaga.create({
          data: {
            id_vaga: novaVaga.id_vaga,
            campos_destaque: original.configuracao.campos_destaque ?? [],
          },
        });
      }

      return novaVaga;
    });
  }

  async atualizarVaga(
    id_vaga: number,
    id_empresa: number | null,
    dados: any,
    is_admin: boolean = false,
    id_autor?: number,
  ) {
    const vagaExistente = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: {
        endereco: true,
        empresa: { select: { tipo_vinculo_aci: true, creditos_vagas: true } },
      },
    });

    if (!vagaExistente) throw new Error("Vaga não encontrada.");

    // 2. Trava de Segurança: Se NÃO for admin, obriga ser o dono da empresa
    if (!is_admin && vagaExistente.id_empresa !== id_empresa) {
      throw new Error(
        "Acesso negado: Você não tem permissão para editar esta vaga.",
      );
    }

    // 3. REGRA DE NEGÓCIO: Verificação de Créditos ao Submeter Rascunho
    let novoStatus = vagaExistente.status;
    let cobrarCredito = false;

    if (is_admin && dados.status) {
      novoStatus = dados.status;
    } else if (
      dados.enviar_para_aprovacao &&
      vagaExistente.status === "RASCUNHO"
    ) {
      // Se era rascunho e agora quer enviar pra aprovação, aplicamos a regra da ACI
      if (vagaExistente.empresa.tipo_vinculo_aci === "NAO_ASSOCIADA") {
        if (vagaExistente.empresa.creditos_vagas <= 0) {
          novoStatus = "AGUARDANDO_PAGAMENTO";
        } else {
          novoStatus = "EM_ANALISE";
          cobrarCredito = true; // Marca para descontar o crédito na transação!
        }
      } else {
        novoStatus = "EM_ANALISE"; // Associadas têm passe livre
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 4. Desconto do Crédito (Se aplicável)
      if (cobrarCredito) {
        await tx.empresa.update({
          where: { id_empresa: vagaExistente.id_empresa },
          data: { creditos_vagas: { decrement: 1 } },
        });
      }

      // 5. Atualizar Endereço
      if (vagaExistente.id_endereco) {
        const dadosEndereco: any = {};
        if (dados.logradouro !== undefined)
          dadosEndereco.logradouro = dados.logradouro;
        if (dados.numero !== undefined) dadosEndereco.numero = dados.numero;
        if (dados.cidade !== undefined) dadosEndereco.cidade = dados.cidade;
        if (dados.uf !== undefined) dadosEndereco.uf = dados.uf;

        await tx.endereco.update({
          where: { id_endereco: vagaExistente.id_endereco },
          data: dadosEndereco,
        });
      }

      // 6. Atualizar a Vaga (Limpando Undefineds e Protegendo Números)
      const dadosVaga: any = {};

      if (dados.beneficios_ids && Array.isArray(dados.beneficios_ids)) {
        await tx.vagaBeneficio.deleteMany({ where: { id_vaga } });
        await tx.vagaBeneficio.createMany({
          data: dados.beneficios_ids.map((id_ben: number) => ({
            id_vaga,
            id_beneficio: id_ben,
          })),
        });
      }

      if (
        dados.perguntas_eliminatorias &&
        Array.isArray(dados.perguntas_eliminatorias)
      ) {
        await tx.vagaPerguntaEliminatoria.deleteMany({ where: { id_vaga } });
        await tx.vagaPerguntaEliminatoria.createMany({
          data: dados.perguntas_eliminatorias.map((p: any) => ({
            id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }

      // Strings e Booleans
      const camposTextuais = [
        "titulo",
        "nivel_hierarquico",
        "modelo_trabalho",
        "tipo_contrato",
        "tipo_diversidade",
        "salario_a_combinar",
        "ocultar_salario",
        "descricao",
        "responsabilidades",
        "requisitos_obrigatorios",
        "diferenciais",
        "empresa_confidencial",
      ];

      camposTextuais.forEach((campo) => {
        if (dados[campo] !== undefined) dadosVaga[campo] = dados[campo];
      });

      // Conversão Segura de Números (Se vier "" do Frontend, vira null)
      if (dados.id_area_atuacao !== undefined)
        dadosVaga.id_area_atuacao = dados.id_area_atuacao
          ? Number(dados.id_area_atuacao)
          : null;
      if (dados.salario_de !== undefined)
        dadosVaga.faixa_salarial_de = dados.salario_de
          ? Number(dados.salario_de)
          : null;
      if (dados.salario_ate !== undefined)
        dadosVaga.faixa_salarial_ate = dados.salario_ate
          ? Number(dados.salario_ate)
          : null;

      // Status e Data de Publicação
      dadosVaga.status = novoStatus;
      if (novoStatus === "ATIVA" && !vagaExistente.data_publicacao) {
        dadosVaga.data_publicacao = new Date();
      }

      const vaga = await tx.vaga.update({
        where: { id_vaga },
        data: dadosVaga,
      });

      // 7. Sincronizar Etapas (Com Trava de Segurança)
      if (dados.etapas && Array.isArray(dados.etapas)) {
        const etapasAtuais = await tx.etapaProcesso.findMany({
          where: { id_vaga },
        });

        const idsNovasEtapas = dados.etapas
          .map((e: any) => e.id_etapa)
          .filter(Boolean);
        const etapasParaRemover = etapasAtuais.filter(
          (ea) => !idsNovasEtapas.includes(ea.id_etapa),
        );

        if (etapasParaRemover.length > 0) {
          const temCandidatos = await tx.candidatura.findFirst({
            where: {
              id_etapa_atual: { in: etapasParaRemover.map((e) => e.id_etapa) },
            },
          });

          if (temCandidatos) {
            throw new Error(
              "Não é possível remover etapas que possuem candidatos vinculados. Mova os candidatos primeiro.",
            );
          }

          await tx.etapaProcesso.deleteMany({
            where: {
              id_etapa: { in: etapasParaRemover.map((e) => e.id_etapa) },
            },
          });
        }

        // Upsert das Etapas
        for (const [idx, e] of dados.etapas.entries()) {
          // Se o Zod stripou o tipo, recriamos a lógica de INICIAL, INTERMEDIARIA, FINAL
          let tipoSeguro = e.tipo || "INTERMEDIARIA";
          if (idx === 0) tipoSeguro = "INICIAL";
          else if (idx === dados.etapas.length - 1) tipoSeguro = "FINAL";

          await tx.etapaProcesso.upsert({
            where: { id_etapa: e.id_etapa || 0 }, // 0 não vai achar, forçando o 'create'
            update: {
              nome_etapa: e.nome_etapa || e.nome,
              ordem: e.ordem ?? idx,
              tipo: tipoSeguro,
              requer_agendamento: e.requer_agendamento || false,
            },
            create: {
              id_vaga,
              nome_etapa: e.nome_etapa || e.nome,
              ordem: e.ordem ?? idx,
              tipo: tipoSeguro,
              requer_agendamento: e.requer_agendamento || false,
            },
          });
        }
      }

      // 8. Auditoria Crítica do Admin
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
    // 1. Forçamos a conversão para número e definimos valores padrão caso venham nulos
    const page = Number(filtros.page) || 1;
    const limit = Number(filtros.limit) || 10;
    const { search, status } = filtros;

    // 2. Cálculo do skip garantindo que seja um número
    const skip = (page - 1) * limit;

    const onde: any = {
      id_empresa,
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { titulo: { contains: search, mode: "insensitive" } },
                {
                  // 🚀 CORREÇÃO AQUI: Entramos na relação "area_atuacao" e buscamos no "nome"
                  area_atuacao: { 
                    nome: { contains: search, mode: "insensitive" } 
                  },
                },
              ],
            }
          : {},
      ],
    };

    try {
      const [total, vagas] = await Promise.all([
        prisma.vaga.count({ where: onde }),
        prisma.vaga.findMany({
          where: onde,
          skip: skip,
          take: limit,
          include: {
            _count: { select: { candidaturas: true } },
            // É bom incluir a área de atuação no retorno para o Front-end mostrar no card!
            area_atuacao: { select: { nome: true } } 
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
    } catch (error) {
      console.error("Erro no Prisma ao listar vagas:", error);
      throw new Error("Erro ao buscar vagas no banco de dados.");
    }
  }

  async listarVagasPendentes(filtros: any) {
    const page = Number(filtros.page) || 1;
    const limit = Number(filtros.limit) || 10;
    const search = filtros.search;

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
      const vagaAtualizada = await tx.vaga.update({
        where: { id_vaga },
        data: {
          status: novoStatus,
          data_publicacao: novoStatus === "ATIVA" ? new Date() : null,
          observacoes_admin: motivo,
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

  async confirmarPagamento(id_vaga: number, id_admin: number) {
    // 1. Busca a vaga para verificar o status atual
    const vaga = await prisma.vaga.findUnique({
      where: { id_vaga },
      select: {
        status: true,
        empresa: {
          select: { nome_fantasia: true, email: true },
        },
      },
    });

    if (!vaga) {
      throw new Error("Vaga não encontrada no sistema.");
    }

    // 2. Trava de segurança: Evita reativar vagas canceladas ou que já estão ativas
    if (vaga.status === "ATIVA") {
      throw new Error(
        "O pagamento desta vaga já foi confirmado e ela já está ativa.",
      );
    }

    if (vaga.status === "EM_ANALISE") {
      throw new Error(
        "O pagamento desta vaga já foi confirmado e ela já está análise.",
      );
    }

    if (vaga.status !== "AGUARDANDO_PAGAMENTO") {
      throw new Error(
        "Esta vaga não está aguardando confirmação de pagamento.",
      );
    }

    // 3. Atualiza o status da vaga para EM_ANALISE
    const vagaAtivada = await prisma.vaga.update({
      where: { id_vaga },
      data: {
        status: "EM_ANALISE",
        data_publicacao: new Date(),
      },
    });

    await prisma.logAuditoria.create({
      data: {
        id_usuario: id_admin,
        acao: "CONFIRMACAO_PAGAMENTO_VAGA",
        detalhes: `Vaga ID ${id_vaga} da empresa ${vaga.empresa.nome_fantasia} liberada.`,
        entidade: "VAGA",
        id_entidade: id_vaga,
      },
    });

    // Dica para o futuro: Aqui seria o lugar perfeito para disparar um e-mail
    // avisando a empresa: "Seu pagamento foi confirmado e sua vaga já está no ar!"

    return vagaAtivada;
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
            endereco: {
              select: { cidade: true, uf: true, bairro: true },
            },
            // ✨ ATUALIZAÇÃO DO INCLUDE: Nova estrutura de áreas
            areas_atuacao: {
              include: { area: { select: { nome: true } } },
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
        email: c.candidato.usuario.email,
        cidade: c.candidato.endereco?.cidade || "Não informada",
        uf: c.candidato.endereco?.uf || "--",
        bairro: c.candidato.endereco?.bairro || "Outro/Não informado",

        // ✨ ATUALIZAÇÃO DO MAPEAMENTO
        areas_profissionais: c.candidato.areas_atuacao?.length
          ? c.candidato.areas_atuacao.map((a) => a.area.nome).join(", ")
          : "Não definida",

        status: c.status_atual,
        id_etapa_atual: c.id_etapa_atual,
        data_inscricao: c.data_candidatura,
      })),
    };
  }

  async listarVagasPublicas(filtros: {
    busca?: string | undefined;
    cidade?: string | undefined;
    pagina?: number | undefined;
    limite?: number | undefined;
    modelo_trabalho?: string | undefined;
    tipo_contrato?: string | undefined;
    somente_pcd?: boolean | undefined;
    nivel_hierarquico?: string | undefined;
    salario_min?: number | undefined;
    salario_max?: number | undefined;
    tipo_pcd?: string | undefined;
    id_area_atuacao?: string | undefined;
  }) {
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 10;
    const pular = (pagina - 1) * limite;

    const whereClause: any = {
      status: "ATIVA",
    };

    // --- 1. BUSCA POR TEXTO ---
    if (filtros.busca) {
      whereClause.OR = [
        { titulo: { contains: filtros.busca, mode: "insensitive" } },
        { descricao: { contains: filtros.busca, mode: "insensitive" } },
      ];
    }

    // --- 2. CORREÇÃO DA CIDADE ---
    if (filtros.cidade) {
      // O Prisma precisa entrar na relação 'endereco' primeiro!
      whereClause.endereco = {
        cidade: { equals: filtros.cidade, mode: "insensitive" },
      };
    }

    // --- 3. ARRAYS DE MÚLTIPLA ESCOLHA (Usando 'in' do Prisma) ---
    // O front manda "PRESENCIAL,HIBRIDO", o split(',') transforma em ['PRESENCIAL', 'HIBRIDO']
    if (filtros.modelo_trabalho) {
      whereClause.modelo_trabalho = { in: filtros.modelo_trabalho.split(",") };
    }

    if (filtros.tipo_contrato) {
      whereClause.tipo_contrato = { in: filtros.tipo_contrato.split(",") };
    }

    if (filtros.nivel_hierarquico) {
      whereClause.nivel_hierarquico = {
        in: filtros.nivel_hierarquico.split(","),
      };
    }

    // --- 4. LÓGICA DE PCD (Mesclando botão rápido com a gaveta) ---
    if (filtros.tipo_pcd && filtros.tipo_pcd !== "TODAS") {
      if (filtros.tipo_pcd === "AFIRMATIVAS") {
        whereClause.tipo_diversidade = "VAGA_INCLUSIVA";
      } else if (filtros.tipo_pcd === "EXCLUSIVAS") {
        whereClause.tipo_diversidade = "EXCLUSIVA_PCD";
      }
    } else if (filtros.somente_pcd) {
      // Se clicou no botão rápido, aceita ambas as modalidades PCD
      whereClause.tipo_diversidade = {
        in: ["VAGA_INCLUSIVA", "EXCLUSIVA_PCD"],
      };
    }

    // --- 5. FAIXA SALARIAL ---
    if (filtros.salario_min) {
      whereClause.faixa_salarial_de = { gte: filtros.salario_min };
    }
    if (filtros.salario_max) {
      whereClause.faixa_salarial_ate = { lte: filtros.salario_max };
    }

    if (filtros.id_area_atuacao) {
      const areaId = Number(filtros.id_area_atuacao);
      if (!isNaN(areaId)) {
        whereClause.id_area_atuacao = areaId;
      }
    }
    // Executa as consultas com a nova whereClause
    const totalVagas = await prisma.vaga.count({
      where: whereClause,
    });

    const vagas = await prisma.vaga.findMany({
      where: whereClause,
      skip: pular,
      take: limite,
      orderBy: {
        data_publicacao: "desc",
      },
      include: {
        empresa: {
          select: {
            nome_fantasia: true,
            logotipo_url: true,
          },
        },
        endereco: {
          select: { cidade: true, uf: true },
        },
        area_atuacao: {
          select: { nome: true },
        },
      },
    });

    // SANITIZAÇÃO DE DADOS MANTIDA INTACTA
    const vagasSanitizadas = vagas.map((vaga) => {
      if (vaga.empresa_confidencial) {
        return {
          ...vaga,
          empresa: {
            nome_fantasia: "Empresa Confidencial",
            logotipo_url: null,
            tipo_vinculo_aci: "NAO_ASSOCIADA",
          },
        };
      }
      return vaga;
    });

    return {
      dados: vagasSanitizadas,
      paginacao: {
        total: totalVagas,
        pagina_atual: pagina,
        total_paginas: Math.ceil(totalVagas / limite),
      },
    };
  }

  async obterDetalhesVagaPublica(id_vaga: number) {
    const vaga = await prisma.vaga.findUnique({
      where: {
        id_vaga: id_vaga,
      },
      include: {
        area_atuacao: {
          select: { nome: true },
        },
        beneficios: {
          include: {
            beneficio: { select: { descricao: true } },
          },
        },

        empresa: {
          select: {
            nome_fantasia: true,
            email: true,
            tipo_vinculo_aci: true,
            logotipo_url: true,
            banner_url: true,
            quem_somos: true,
            site: true,
            instagram: true,
            linkedin: true,
            facebook: true,
            endereco: true,
          },
        },
      },
    });

    if (!vaga) {
      throw new Error("Vaga não encontrada.");
    }

    return vaga;
  }

  async obterFiltrosDisponiveis() {
    const baseWhere = { status: "ATIVA" as const };

    const [
      enderecosBrutos,
      modelosTrabalho,
      tiposContrato,
      tiposDiversidade,
      areasComVagas,
      niveisHierarquicos,
    ] = await Promise.all([
      prisma.endereco.findMany({
        where: {
          vaga: baseWhere,
        },
        select: { uf: true, cidade: true },
        distinct: ["uf", "cidade"],
      }),
      prisma.vaga.groupBy({
        by: ["modelo_trabalho"],
        where: baseWhere,
      }),
      prisma.vaga.groupBy({
        by: ["tipo_contrato"],
        where: baseWhere,
      }),
      prisma.vaga.groupBy({
        by: ["tipo_diversidade"],
        where: baseWhere,
      }),
      prisma.areaAtuacao.findMany({
        where: {
          vagas: { some: baseWhere },
        },
        // CORREÇÃO: Alterado de 'id_area_atuacao' para 'id_area'
        select: { id_area: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.vaga.groupBy({
        by: ["nivel_hierarquico"],
        where: baseWhere,
      }),
    ]);

    // --- FORMATAÇÃO DOS LOCAIS ---
    const locaisMap = new Map<string, Set<string>>();

    for (const end of enderecosBrutos) {
      if (!end.uf || !end.cidade) continue;

      if (!locaisMap.has(end.uf)) {
        locaisMap.set(end.uf, new Set());
      }
      locaisMap.get(end.uf)!.add(end.cidade);
    }

    const locaisFormatados = Array.from(locaisMap.entries())
      .map(([uf, cidadesSet]) => ({
        uf,
        cidades: Array.from(cidadesSet).sort(),
      }))
      .sort((a, b) => a.uf.localeCompare(b.uf));

    // --- RETORNO FORMATADO ---
    return {
      locais: locaisFormatados,
      modelos: modelosTrabalho.map((m) => m.modelo_trabalho),
      contratos: tiposContrato.map((c) => c.tipo_contrato),
      diversidade: tiposDiversidade
        .map((d) => d.tipo_diversidade)
        .filter((d) => d !== null),
      areas: areasComVagas,
      niveis: niveisHierarquicos
        .map((n) => n.nivel_hierarquico)
        .filter((n) => n !== null),
    };
  }


  // =========================================================
  // 1. PAUSAR VAGA
  // =========================================================
  async pausarVaga(id_vaga: number, id_empresa: number, id_autor: number) {
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      select: { status: true }
    });

    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");
    if (vaga.status !== "ATIVA") {
      throw new Error("Apenas vagas ativas podem ser pausadas.");
    }

    return await prisma.$transaction(async (tx) => {
      const atualizada = await tx.vaga.update({
        where: { id_vaga },
        data: { status: "PAUSADA" },
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "PAUSAR_VAGA",
          entidade: "Vaga",
          id_entidade: id_vaga,
          detalhes: { status_anterior: "ATIVA", novo_status: "PAUSADA" }
        }
      });

      return atualizada;
    });
  }

  // =========================================================
  // 2. ATIVAR VAGA (RETORNAR DA PAUSA)
  // =========================================================
  async ativarVaga(id_vaga: number, id_empresa: number, id_autor: number) {
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      select: { status: true }
    });

    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");
    if (vaga.status !== "PAUSADA") {
      throw new Error("Apenas vagas pausadas podem ser reativadas.");
    }

    return await prisma.$transaction(async (tx) => {
      const atualizada = await tx.vaga.update({
        where: { id_vaga },
        data: { status: "ATIVA" },
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ATIVAR_VAGA",
          entidade: "Vaga",
          id_entidade: id_vaga,
          detalhes: { status_anterior: "PAUSADA", novo_status: "ATIVA" }
        }
      });

      return atualizada;
    });
  }

  // =========================================================
  // 3. ENCERRAR VAGA (COM REPROVAÇÃO EM MASSA)
  // =========================================================
  async encerrarVaga(
    id_vaga: number,
    id_empresa: number,
    id_autor: number,
    motivo: string = "A vaga foi encerrada e o processo seletivo finalizado."
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Validar a vaga
      const vaga = await tx.vaga.findFirst({
        where: { id_vaga, id_empresa },
        select: { status: true }
      });

      if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");
      if (vaga.status === "ENCERRADA") throw new Error("Esta vaga já está encerrada.");

      // 2. Buscar candidatos ativos (que não estão Aprovados, Reprovados ou Desistentes)
      const candidatosPendentes = await tx.candidatura.findMany({
        where: {
          id_vaga,
          status_atual: {
            notIn: ["APROVADO", "REPROVADO", "DESISTENCIA"],
          },
        },
        select: { id_candidatura: true, id_etapa_atual: true },
      });

      // 3. Se houver candidatos sobrando, faz a reprovação em massa
      if (candidatosPendentes.length > 0) {
        const ids = candidatosPendentes.map((c) => c.id_candidatura);

        // Cria os eventos de reprovação (Com notificação PENDENTE = true na nova tabela!)
        await tx.movimentoCandidatura.createMany({
          data: candidatosPendentes.map((c) => ({
            id_candidatura: c.id_candidatura,
            etapa_origem: c.id_etapa_atual,
            etapa_destino: c.id_etapa_atual, // Ele estaciona na etapa onde parou
            status_destino: "REPROVADO",
            motivo: motivo,
            notificacao_pendente: true, // 🚀 Libera para envio de e-mail de feedback!
          })),
        });

        // Atualiza o status físico das candidaturas
        await tx.candidatura.updateMany({
          where: { id_candidatura: { in: ids } },
          data: {
            status_atual: "REPROVADO",
          },
        });
      }

      // 4. Atualizar o status da Vaga
      const vagaEncerrada = await tx.vaga.update({
        where: { id_vaga },
        data: {
          status: "ENCERRADA",
          data_encerramento: new Date(),
        },
      });

      // 5. Criar Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ENCERRAR_VAGA",
          entidade: "Vaga",
          id_entidade: id_vaga,
          detalhes: { 
            candidatos_reprovados_automaticamente: candidatosPendentes.length, 
            motivo 
          }
        }
      });

      return vagaEncerrada;
    });
  }
}
