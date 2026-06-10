import type { TurnoPreferido } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export class BancoTalentosService {
  async listarVitrine(filtros: {
    competencia?: number[] | undefined;
    id_area?: number | undefined;
    turno?: string[] | undefined;
    primeiro_emprego?: boolean | undefined;
    pcd?: boolean | undefined;
    disponibilidade_sabados?: boolean | undefined;
    disponibilidade_viagem?: boolean | undefined;
    cnh?: string[] | undefined;
    escolaridade?: string[] | undefined;
    pagina?: number | undefined;
    limite?: number | undefined;
  }) {
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 10;
    const skip = (pagina - 1) * limite;

    // 1. Regra de Ouro: SÓ busca quem quer ser visto e está ativo
    const whereClause: any = {
      perfil_visivel_empresas: true,
      usuario: { status: "ATIVO" },
    };

    // 2. Filtros Básicos e Logísticos
    if (filtros.id_area) {
      whereClause.areas_atuacao = {
        some: { id_area: filtros.id_area },
      };
    }

    if (filtros.turno && filtros.turno.length > 0) {
      whereClause.turno_preferido = {
        hasSome: filtros.turno, // Verifica se o candidato tem ALGUM dos turnos selecionados
      };
    }

    if (filtros.primeiro_emprego !== undefined) {
      whereClause.primeiro_emprego = filtros.primeiro_emprego;
    }

    if (filtros.pcd !== undefined) {
      whereClause.pcd = filtros.pcd;
    }

    if (filtros.disponibilidade_sabados !== undefined) {
      whereClause.disponibilidade_sabados = filtros.disponibilidade_sabados;
    }

    if (filtros.disponibilidade_viagem !== undefined) {
      whereClause.disponibilidade_viagem = filtros.disponibilidade_viagem;
    }

    if (filtros.cnh && filtros.cnh.length > 0) {
      whereClause.cnh = {
        hasSome: filtros.cnh, // Verifica se o candidato tem ALGUMA das CNHs exigidas
      };
    }

    if (filtros.competencia && filtros.competencia.length > 0) {
      whereClause.competencias = {
        some: {
          id_competencia: { in: filtros.competencia }, // Pega candidatos que tenham pelo menos UMA das habilidades
        },
      };
    }

    // 3. Filtro Avançado de Escolaridade (Multi-select)
    if (filtros.escolaridade && filtros.escolaridade.length > 0) {
      const niveisPermitidos: string[] = [];
      const statusPermitidos: string[] = [];

      if (filtros.escolaridade.includes("MEDIO_COMPLETO")) {
        niveisPermitidos.push("Ensino Médio");
        statusPermitidos.push("CONCLUÍDO");
      }
      if (filtros.escolaridade.includes("TECNICO")) {
        niveisPermitidos.push("Curso Técnico");
      }
      if (filtros.escolaridade.includes("SUPERIOR_CURSANDO")) {
        niveisPermitidos.push("Graduação", "Superior (Tecnólogo)");
        statusPermitidos.push("CURSANDO");
      }
      if (filtros.escolaridade.includes("SUPERIOR_COMPLETO")) {
        niveisPermitidos.push(
          "Graduação",
          "Superior (Tecnólogo)",
          "Pós-Graduação / Especialização",
          "Mestrado / Doutorado",
        );
        statusPermitidos.push("CONCLUÍDO");
      }

      const formacaoQuery: any = {
        nivel: { in: niveisPermitidos },
      };

      // Só aplica filtro de status se ele for relevante para as opções selecionadas
      if (statusPermitidos.length > 0) {
        formacaoQuery.status = { in: statusPermitidos };
      }

      whereClause.formacoes = {
        some: formacaoQuery,
      };
    }

    // 4. Executa a busca paralela
    const [total, candidatos] = await Promise.all([
      prisma.candidato.count({ where: whereClause }),

      prisma.candidato.findMany({
        where: whereClause,
        skip,
        take: limite,
        orderBy: { usuario: { atualizado_em: "desc" } },

        select: {
          id_usuario: true,
          objetivo_profissional: true,
          resumo_profissional: true,
          pretensao_salarial: true,
          turno_preferido: true,
          primeiro_emprego: true,
          pcd: true,

          endereco: { select: { cidade: true, uf: true } },

          areas_atuacao: {
            include: { area: { select: { nome: true } } },
          },

          experiencias: {
            select: {
              cargo: true,
              empresa: true,
              data_inicio: true,
              data_fim: true,
              atual: true,
            },
            orderBy: { data_inicio: "desc" },
          },
          formacoes: {
            select: { curso: true, nivel: true, instituicao: true },
          },
          competencias: {
            include: { competencia: { select: { nome: true } } },
          },
        },
      }),
    ]);

    // 5. Formatação Final
    const dadosMascarados = candidatos.map((c) => {
      const areaPrincipal = c.areas_atuacao[0]?.area.nome || "Profissional";

      return {
        id_candidato: c.id_usuario,
        identificacao_publica: `Candidato #${c.id_usuario} - ${areaPrincipal}`,

        objetivo_profissional: c.objetivo_profissional,
        resumo_profissional: c.resumo_profissional,
        cidade: c.endereco?.cidade || "Não informada",
        uf: c.endereco?.uf || "--",
        turno_preferido: c.turno_preferido,
        primeiro_emprego: c.primeiro_emprego,
        pcd: c.pcd,

        areas: c.areas_atuacao.map((a) => a.area.nome),
        competencias: c.competencias.map((comp) => comp.competencia.nome),
        experiencias: c.experiencias,
        formacoes: c.formacoes,
      };
    });

    return {
      dados: dadosMascarados,
      paginacao: {
        total,
        pagina_atual: pagina,
        total_paginas: Math.ceil(total / limite),
      },
    };
  }
  async obterCurriculo(id_candidato: number, id_empresa: number) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_curriculos: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // 2. Busca o currículo completo
    const candidato = await prisma.candidato.findUnique({
      where: { id_usuario: id_candidato },
      include: {
        usuario: { select: { nome: true, email: true, status: true } },
        endereco: true,
        areas_atuacao: { include: { area: { select: { nome: true } } } },
        experiencias: { orderBy: { data_inicio: "desc" } },
        formacoes: { orderBy: { data_conclusao: "desc" } },
        competencias: { include: { competencia: { select: { nome: true } } } },
      },
    });

    // 3. Regra de Segurança Básica
    if (
      !candidato ||
      !candidato.perfil_visivel_empresas ||
      candidato.usuario.status !== "ATIVO"
    ) {
      throw new Error("Este currículo não está disponível no momento.");
    }

    // ✨ A MÁGICA DO "FAVORITO" AQUI
    // Consulta super rápida para checar se essa empresa já favoritou esse candidato
    const checkSalvo = await prisma.curriculoSalvo.findUnique({
      where: {
        id_empresa_id_candidato: {
          id_empresa: id_empresa,
          id_candidato: id_candidato,
        },
      },
    });

    // Transforma o resultado da query em um booleano (true ou false)
    const isCandidatoSalvo = !!checkSalvo;

    // 4. A INTELIGÊNCIA DE ACESSO
    let acessoLiberado = false;

    if (empresa.tipo_vinculo_aci === "ASSOCIADA") {
      acessoLiberado = true; // Sócio da ACI tem passe livre
    } else {
      const jaDesbloqueou = await prisma.curriculoDesbloqueado.findUnique({
        where: {
          id_empresa_id_candidato: {
            id_empresa: id_empresa,
            id_candidato: id_candidato,
          },
        },
      });

      if (jaDesbloqueou) {
        acessoLiberado = true;
      }
    }

    // --- 🚀 GATILHO DE VISUALIZAÇÃO (LOG) ---
    if (acessoLiberado) {
      prisma.visualizacaoCurriculo
        .create({
          data: {
            id_candidato: id_candidato,
            id_empresa: id_empresa,
          },
        })
        .catch((err) => {
          console.error(
            `Erro ao registrar view do candidato ${id_candidato}:`,
            err.message,
          );
        });
    }
    // ----------------------------------------

    // 5. Monta o payload base
    const areaPrincipal =
      candidato.areas_atuacao[0]?.area.nome || "Profissional";

    const dadosProfissionais = {
      id_candidato: candidato.id_usuario,
      is_salvo: isCandidatoSalvo, // ✨ AQUI VAI A FLAG PARA O FRONTEND
      objetivo_profissional: candidato.objetivo_profissional,
      resumo_profissional: candidato.resumo_profissional,
      pretensao_salarial: candidato.pretensao_salarial,
      turno_preferido: candidato.turno_preferido,
      disponibilidade_sabados: candidato.disponibilidade_sabados,
      disponibilidade_viagem: candidato.disponibilidade_viagem,
      cnh: candidato.cnh,
      primeiro_emprego: candidato.primeiro_emprego,
      pcd: candidato.pcd,
      tipo_pcd: candidato.tipo_pcd,
      necessidade: candidato.necessidade,
      areas: candidato.areas_atuacao.map((a) => a.area.nome),
      competencias: candidato.competencias.map((c) => ({
        nome: c.competencia.nome,
        nivel: c.nivel,
      })),
      experiencias: candidato.experiencias,
      formacoes: candidato.formacoes,
    };

    // 6. O BIFURCADOR
    if (acessoLiberado) {
      return {
        acesso_liberado: true,
        perfil: {
          ...dadosProfissionais,
          nome: candidato.usuario.nome,
          foto_url: candidato.foto_url,
          email: candidato.usuario.email,
          cpf: candidato.cpf,
          telefone: candidato.telefone,
          whatsapp: candidato.whatsapp,
          tipo_contato: candidato.tipo_contato,
          link_linkedin: candidato.link_linkedin,
          link_portfolio: candidato.link_portfolio,
          link_outro: candidato.link_outro,
          endereco_completo: candidato.endereco,
        },
      };
    } else {
      return {
        acesso_liberado: false,
        pode_desbloquear: true,
        saldo_creditos_empresa: empresa.creditos_curriculos,
        perfil: {
          ...dadosProfissionais,
          nome: `Candidato #${candidato.id_usuario} - ${areaPrincipal}`,
          foto_url: null,
          email: "***@***.com",
          cpf: "***.***.***-**",
          telefone: "(**) *****-****",
          whatsapp: "(**) *****-****",
          tipo_contato: candidato.tipo_contato,
          link_linkedin: null,
          link_portfolio: null,
          link_outro: null,
          endereco_completo: {
            cidade: candidato.endereco?.cidade || "Não informada",
            uf: candidato.endereco?.uf || "--",
            bairro: candidato.endereco?.bairro || null,
          },
        },
      };
    }
  }

  async desbloquearCurriculoTransacao(
    id_candidato: number,
    id_empresa: number,
    id_usuario_logado: number
  ) {
    // 1. Validações Iniciais (Fora da transação para economizar processamento do banco)
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_curriculos: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // Empresas associadas não precisam (e não devem) gastar créditos
    if (empresa.tipo_vinculo_aci === "ASSOCIADA") {
      throw new Error(
        "Sua empresa é associada e já possui acesso ilimitado aos currículos.",
      );
    }

    // Verifica se já não foi desbloqueado antes (evita duplo clique/cobrança dupla)
    const jaDesbloqueado = await prisma.curriculoDesbloqueado.findUnique({
      where: {
        id_empresa_id_candidato: {
          id_empresa: id_empresa,
          id_candidato: id_candidato,
        },
      },
    });

    if (jaDesbloqueado) {
      throw new Error(
        "Este currículo já foi desbloqueado anteriormente pela sua empresa.",
      );
    }

    // 2. A Regra de Negócio de Saldo (Gatilho para o 403)
    if (empresa.creditos_curriculos <= 0) {
      throw new Error("SALDO_INSUFICIENTE");
    }

    // 3. A Transação Financeira e de Métricas (Tudo ou Nada)
    await prisma.$transaction(async (tx) => {
      // 3.1. Deduz 1 crédito do saldo da empresa
      await tx.empresa.update({
        where: { id_empresa },
        data: {
          creditos_curriculos: { decrement: 1 },
        },
      });

      // 3.2. Registra o recibo de desbloqueio na tabela pivô
      await tx.curriculoDesbloqueado.create({
        data: {
          id_empresa: id_empresa,
          id_candidato: id_candidato,
        },
      });

      // 3.3. 🚀 O GATILHO DA VISUALIZAÇÃO 🚀
      // Se a empresa gastou o crédito, ela "abriu" o perfil. Contamos a view para o candidato!
      await tx.visualizacaoCurriculo.create({
        data: {
          id_candidato: id_candidato,
          id_empresa: id_empresa,
        },
      });

      // 3.4. Registrar no Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_usuario_logado, // ✨ CORRIGIDO AQUI!
          entidade: "CANDIDATO",
          id_entidade: id_candidato,
          acao: "DESBLOQUEIO_CURRICULO_CREDITO",
          detalhes: {
            custo: 1,
            saldo_restante: empresa.creditos_curriculos - 1,
          },
        },
      });
    });
    return await this.obterCurriculo(id_candidato, id_empresa);
  }

async listarMeusDesbloqueados(id_empresa: number) {
    // 1. Buscamos todos os currículos salvos por esta empresa para comparar
    const salvos = await prisma.curriculoSalvo.findMany({
      where: { id_empresa },
      select: { id_candidato: true }
    });

    // Criamos um Set com os IDs para ter uma busca de alta performance O(1)
    const idsSalvosSet = new Set(salvos.map(s => s.id_candidato));

    // 2. Busca todos os registros de desbloqueio desta empresa (sua query original)
    const historico = await prisma.curriculoDesbloqueado.findMany({
      where: { id_empresa },
      orderBy: { data_desbloqueio: "desc" },
      include: {
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true, status: true } },
            endereco: { select: { cidade: true, uf: true } },
            areas_atuacao: { include: { area: { select: { nome: true } } } },
            experiencias: {
              orderBy: { data_inicio: "desc" },
              take: 1,
              select: { cargo: true, empresa: true },
            },
          },
        },
      },
    });

    // 3. Formata para o Front-end
    const gaveta = historico.map((registro) => {
      const c = registro.candidato;
      const areaPrincipal = c.areas_atuacao[0]?.area.nome || "Profissional";
      const ultimaExp = c.experiencias[0]
        ? `${c.experiencias[0].cargo} na ${c.experiencias[0].empresa}`
        : "Sem experiência registrada";

      return {
        id_candidato: c.id_usuario,
        data_desbloqueio: registro.data_desbloqueio,
        
        // ✨ A NOVA PROPRIEDADE AQUI:
        // Verifica se o ID deste candidato está no nosso conjunto de salvos
        is_salvo: idsSalvosSet.has(c.id_usuario),

        // Dados Liberados
        nome: c.usuario.nome,
        email: c.usuario.email,
        foto_url: c.foto_url,
        whatsapp: c.whatsapp,
        telefone: c.telefone,
        link_linkedin: c.link_linkedin,

        // Resumo Profissional
        area_principal: areaPrincipal,
        cidade: c.endereco?.cidade || "Não informada",
        uf: c.endereco?.uf || "--",
        ultima_experiencia: ultimaExp,

        // Flag para o Front-end saber se o cara pausou a conta depois que a empresa comprou
        perfil_ativo: c.usuario.status === "ATIVO" && c.perfil_visivel_empresas,
      };
    });

    return gaveta;
  }

  async listarAreasComContagem() {
    // Dispara as duas consultas ao mesmo tempo no banco de dados
    const [areas, totalCandidatosUnicos] = await Promise.all([
      // 1. Busca as áreas e a quantidade de candidatos em cada uma
      prisma.areaAtuacao.findMany({
        orderBy: { nome: "asc" },
        select: {
          id_area: true,
          nome: true,
          _count: {
            select: {
              candidatos: {
                where: {
                  candidato: {
                    perfil_visivel_empresas: true,
                    usuario: { status: "ATIVO" },
                  },
                },
              },
            },
          },
        },
      }),

      // 2. Conta o número real e único de candidatos visíveis na plataforma
      prisma.candidato.count({
        where: {
          perfil_visivel_empresas: true,
          usuario: { status: "ATIVO" },
        },
      }),
    ]);

    // Formata a lista de áreas para o frontend
    const areasFormatadas = areas.map((area) => ({
      id_area: area.id_area,
      nome: area.nome,
      total_candidatos: area._count.candidatos,
    }));

    // Retorna o objeto completo, agora com o número exato sem duplicações!
    return {
      total_geral: totalCandidatosUnicos,
      areas: areasFormatadas,
    };
  }
  // 1. Alternar Favorito (Salvar / Remover)
  async alternarCurriculoSalvo(
    id_candidato: number,
    id_empresa: number,
  ) {
    const salvoExistente = await prisma.curriculoSalvo.findUnique({
      where: {
        id_empresa_id_candidato: { id_empresa, id_candidato },
      },
    });

    if (salvoExistente) {
      
      await prisma.curriculoSalvo.delete({
        where: { id_salvo: salvoExistente.id_salvo },
      });
      return { favoritado: false, mensagem: "Currículo removido dos salvos." };
    } else {
      await prisma.curriculoSalvo.create({
        data: {
          id_empresa: id_empresa,
          id_candidato: id_candidato,
        },
      });
      return { favoritado: true, mensagem: "Currículo salvo com sucesso!" };
    }
  }

  // 2. Listar Favoritos (Com filtro de censura embutido)
async listarCurriculosSalvos(id_empresa: number) {
    // Busca os dados da empresa e a lista de quem ela já PAGOU para ver
    const [empresa, desbloqueios] = await Promise.all([
      prisma.empresa.findUnique({
        where: { id_empresa },
        select: { tipo_vinculo_aci: true },
      }),
      prisma.curriculoDesbloqueado.findMany({
        where: { id_empresa },
        select: { id_candidato: true },
      }),
    ]);

    if (!empresa) throw new Error("Empresa não encontrada.");

    // ✨ Melhoria de Performance: Usando Set O(1) ao invés de Array.includes O(N)
    const idsLiberadosSet = new Set(desbloqueios.map((d) => d.id_candidato));
    const isAssociada = empresa.tipo_vinculo_aci === "ASSOCIADA";

    // Busca a lista de favoritos
    const favoritos = await prisma.curriculoSalvo.findMany({
      where: { id_empresa },
      orderBy: { criado_em: "desc" },
      include: {
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true, status: true } },
            endereco: { select: { cidade: true, uf: true } },
            areas_atuacao: { include: { area: { select: { nome: true } } } },
            experiencias: {
              orderBy: { data_inicio: "desc" },
              take: 1,
              select: { cargo: true, empresa: true },
            },
          },
        },
      },
    });

    // Formata a resposta aplicando a regra de censura
    return favoritos.map((fav) => {
      const c = fav.candidato;
      const areaPrincipal = c.areas_atuacao[0]?.area.nome || "Profissional";
      const ultimaExp = c.experiencias[0]
        ? `${c.experiencias[0].cargo} na ${c.experiencias[0].empresa}`
        : "Sem experiência registrada";

      // A MÁGICA DA SEGURANÇA: Tem acesso liberado?
      const acessoLiberado = isAssociada || idsLiberadosSet.has(c.id_usuario);

      // ✨ AQUI ESTÁ A NOVA FLAG DE STATUS DO PERFIL
      const perfilAtivo = c.usuario.status === "ATIVO" && c.perfil_visivel_empresas;

      const payloadBase = {
        id_candidato: c.id_usuario,
        data_salvo: fav.criado_em,
        observacoes_empresa: fav.observacoes, // A anotação que ela fez
        area_principal: areaPrincipal,
        ultima_experiencia: ultimaExp,
        acesso_liberado: acessoLiberado,
        is_salvo: true, // Já que estamos na lista de favoritos, sempre será true
        perfil_ativo: perfilAtivo, // Retorna se o perfil tá no ar ou foi ocultado
      };

      if (acessoLiberado) {
        return {
          ...payloadBase,
          nome: c.usuario.nome,
          email: c.usuario.email,
          foto_url: c.foto_url,
          telefone: c.telefone,
          whatsapp: c.whatsapp,
          cidade: c.endereco?.cidade || "Não informada",
          uf: c.endereco?.uf || "--",
        };
      } else {
        return {
          ...payloadBase,
          nome: `Candidato #${c.id_usuario} - ${areaPrincipal}`,
          email: "***@***.com",
          foto_url: null,
          telefone: "(**) *****-****",
          whatsapp: "(**) *****-****",
          cidade: c.endereco?.cidade || "Não informada",
          uf: c.endereco?.uf || "--",
        };
      }
    });
  }
}
