import { prisma } from "../config/prisma.js";
import { StatusCandidatura } from "@prisma/client";

export class CandidaturaService {
  async kanban(id_vaga: number, id_empresa: number) {
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      include: {
        etapas: { orderBy: { ordem: "asc" } },
      },
    });

    if (!vaga) throw new Error("Vaga não encontrada.");

    const candidaturas = await prisma.candidatura.findMany({
      where: { id_vaga },
      include: {
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true } },
            areas_atuacao: true,
          },
        },
        respostas: true,
        agendamento: true,
        avaliacao: true,
      },
    });

    const notificacoesPendentes = await prisma.candidatura.count({
    where: {
    id_vaga: Number(id_vaga),
    notificacao_pendente: true,
      },
    });

    return {
      vaga: { titulo: vaga.titulo, status: vaga.status },
      colunas: vaga.etapas.map((etapa) => ({
        ...etapa,
        notificacoes_pendentes: notificacoesPendentes,
        candidatos: candidaturas
          .filter((c) => c.id_etapa_atual === etapa.id_etapa)
          .map((c) => ({
            id_candidatura: c.id_candidatura,
            nome: c.candidato.usuario.nome,
            id_usuario: c.id_candidato,
            fora_do_perfil: c.respostas.some((r) => r.fora_do_perfil),
            data_inscricao: c.data_candidatura,
            possui_agendamento: !!c.agendamento,
            visualizada: c.visualizada || false,
            data_entrevista: c.agendamento?.data_hora || null,
            avaliacao_nota: c.avaliacao?.pontuacao || null,
            whatsapp: c.candidato.whatsapp || null,
            status: c.status_atual,
          })),
      })),
    };
  }

  async candidatar(id_vaga: number, id_candidato: number) {
    // 1. Trava de Segurança: Verificar se já existe candidatura ativa para este usuário nesta vaga
    const candidaturaExistente = await prisma.candidatura.findFirst({
      where: { id_vaga, id_candidato },
    });

    if (candidaturaExistente) {
      throw new Error("Você já está inscrito nesta vaga.");
    }

    const vaga = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: {
        perguntas_eliminatorias: true,
        etapas: { orderBy: { ordem: "asc" } },
      },
    });

    if (!vaga || vaga.status !== "ATIVA") {
      throw new Error("Esta vaga não está aberta para candidaturas.");
    }

    // 2. Processamento da Triagem Inteligente
    let reprovadoNaTriagem = false;

    // 3. Definição da Etapa Inicial
    const primeiraEtapa = vaga.etapas[0]?.id_etapa;
    if (!primeiraEtapa) {
      throw new Error("Erro na configuração da vaga: sem etapas definidas.");
    }

    // 4. Persistência Atômica
    return await prisma.candidatura.create({
      data: {
        id_vaga,
        id_candidato,
        // Se reprovado, podemos marcar uma etapa 0 ou manter a primeira para histórico
        id_etapa_atual: primeiraEtapa,
        status_atual: reprovadoNaTriagem
          ? StatusCandidatura.REPROVADO
          : StatusCandidatura.INSCRITO,
        data_candidatura: new Date(),
      },
      include: {
        vaga: { select: { titulo: true } }, // Para facilitar o retorno ao usuário
      },
    });
  }

  async moverCandidato(
    id_candidatura: number,
    id_etapa_destino: number,
    id_empresa: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const candidatura = await tx.candidatura.findUnique({
        where: { id_candidatura },
        include: { vaga: { select: { id_empresa: true } } },
      });

      if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
        throw new Error("Candidatura não encontrada ou acesso negado.");
      }

      // Buscamos a etapa de origem e a de destino para comparar a ORDEM
      const etapaOrigem = await tx.etapaProcesso.findUnique({
        where: { id_etapa: candidatura.id_etapa_atual }
      });

      const etapaDestino = await tx.etapaProcesso.findUnique({
        where: { id_etapa: id_etapa_destino },
      });

      if (!etapaDestino || etapaDestino.id_vaga !== candidatura.id_vaga) {
        throw new Error("Etapa de destino inválida para esta vaga.");
      }

      let novoStatus: StatusCandidatura = "TRIAGEM"; 
      if (etapaDestino.tipo === "FINAL") novoStatus = "APROVADO";
      if (etapaDestino.nome_etapa.toLowerCase().includes("entrevista")) {
        novoStatus = "ENTREVISTA";
      }

      // 🛡️ A BLINDAGEM MÁXIMA ANTI-IOIÔ 🛡️
      // Verifica no histórico se o candidato já esteve nesta etapa de destino alguma vez
      const jaPassouPorAqui = await tx.movimentoCandidatura.findFirst({
        where: {
          id_candidatura,
          etapa_destino: id_etapa_destino
        }
      });

      // 1. Está indo para a direita? (ordem maior)
      const isAvanco = etapaOrigem ? (etapaDestino.ordem > etapaOrigem.ordem) : true;
      
      // 2. Só notifica se for um avanço E a etapa não exigir agendamento E NUNCA TIVER PASSADO POR LÁ
      const podeNotificarStatus = isAvanco && !etapaDestino.requer_agendamento && !jaPassouPorAqui;

      await tx.movimentoCandidatura.create({
        data: {
          id_candidatura,
          etapa_origem: candidatura.id_etapa_atual,
          etapa_destino: id_etapa_destino,
          status_destino: novoStatus,
          motivo: `Movido para etapa: ${etapaDestino.nome_etapa}`,
        },
      });

      return await tx.candidatura.update({
        where: { id_candidatura },
        data: {
          id_etapa_atual: id_etapa_destino,
          status_atual: novoStatus,
          // Se for avanço genuíno e inédito, notifica. Senão, preserva o estado anterior de pendência.
          notificacao_pendente: podeNotificarStatus ? true : candidatura.notificacao_pendente,
        },
      });
    });
  }

  async avancarCandidato(id_candidatura: number, id_empresa: number) {
    // 1. Busca a candidatura para pegar qual é a etapa atual e a vaga
    const candidatura = await prisma.candidatura.findUnique({
      where: { id_candidatura },
      include: { vaga: { select: { id_empresa: true } } },
    });

    if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
      throw new Error("Candidatura não encontrada ou acesso negado.");
    }

    // 2. Busca os detalhes da etapa em que o candidato está agora
    const etapaAtual = await prisma.etapaProcesso.findUnique({
      where: { id_etapa: candidatura.id_etapa_atual },
    });

    if (!etapaAtual) {
      throw new Error("Etapa atual não encontrada no sistema.");
    }

    // 3. A MÁGICA: Busca a próxima etapa daquela vaga (ordem maior que a atual)
    const proximaEtapa = await prisma.etapaProcesso.findFirst({
      where: {
        id_vaga: candidatura.id_vaga,
        ordem: { gt: etapaAtual.ordem }, // gt = greater than (maior que)
      },
      orderBy: {
        ordem: "asc", // Pega a imediatamente seguinte
      },
    });

    // 4. Se não achou uma próxima etapa, é porque ele já está na última
    if (!proximaEtapa) {
      throw new Error("Este candidato já está na última etapa do processo.");
    }

    // 5. O CHAMADO CORRETO: Passando os 3 parâmetros separados por vírgula!
    // A inteligência do "status" e do "motivo" agora vive 100% dentro do moverCandidato.
    return await this.moverCandidato(
      id_candidatura,
      proximaEtapa.id_etapa,
      id_empresa
    );
  }

    async agendarEntrevista(
    id_candidatura: number,
    id_empresa: number,
    dados: { data_hora: Date; local_link: string; observacoes?: string },
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Validar se a empresa é dona da vaga do candidato
      const candidatura = await tx.candidatura.findUnique({
        where: { id_candidatura },
        include: { vaga: { select: { id_empresa: true } } },
      });

      if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
        throw new Error("Candidatura não encontrada ou acesso negado.");
      }

      // 2. Criar ou atualizar o agendamento (Resolvendo erro de undefined/null)
      const agendamento = await tx.agendamentoEntrevista.upsert({
        where: { id_candidatura },
        create: {
          id_candidatura,
          data_hora: dados.data_hora,
          local_link: dados.local_link,
          // CORREÇÃO: Forçamos null se for undefined para agradar o Prisma
          observacoes: dados.observacoes ?? null,
        },
        update: {
          data_hora: dados.data_hora,
          local_link: dados.local_link,
          // CORREÇÃO: Forçamos null se for undefined
          observacoes: dados.observacoes ?? null,
        },
      });

      // 3. Após agendar, liberamos a notificação para o Safe Send [cite: 262, 265]
      await tx.candidatura.update({
        where: { id_candidatura },
        data: { notificacao_pendente: true },
      });

      return agendamento;
    });
  }


async processarNotificacoesPendentes(id_vaga: number, id_empresa: number) {
    // 1. Busca os pendentes trazendo os dados necessários para o disparo
    const pendentes = await prisma.candidatura.findMany({
      where: {
        id_vaga,
        notificacao_pendente: true,
        vaga: { id_empresa },
      },
      include: {
        candidato: {
          include: { usuario: { select: { nome: true, email: true } } }
        },
        agendamento: true, // Importante caso a notificação seja de entrevista
      }
    });

    if (pendentes.length === 0) return []; // Retorna array vazio se não tiver nada

    // 2. Marca no banco que as pendências foram resolvidas
    await prisma.candidatura.updateMany({
      where: { id_candidatura: { in: pendentes.map((p) => p.id_candidatura) } },
      data: { notificacao_pendente: false },
    });

    // 3. 🛡️ CORREÇÃO: Retorna o array CHEIO de dados para o Controller disparar os e-mails!
    return pendentes; 
  }

  async reprovarEmMassa(
    id_candidaturas: number[],
    motivo: string,
    id_empresa: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const candidaturas = await tx.candidatura.findMany({
        where: {
          id_candidatura: { in: id_candidaturas },
          vaga: { id_empresa },
          status_atual: {
            notIn: ["REPROVADO", "DESISTENCIA"]
          }
        },
        select: { id_candidatura: true, id_etapa_atual: true },
      });

      if (candidaturas.length !== id_candidaturas.length) {
        throw new Error("Candidaturas inválidas.");
      }

     await tx.movimentoCandidatura.createMany({
        data: candidaturas.map((c) => ({
          id_candidatura: c.id_candidatura,
          etapa_origem: c.id_etapa_atual,
          etapa_destino: c.id_etapa_atual, // <-- Correção: Ele "estaciona" na etapa atual
          status_destino: "REPROVADO",
          motivo: motivo || "Reprovação em lote",
        })),
      });

      return await tx.candidatura.updateMany({
        where: { id_candidatura: { in: id_candidaturas } },
        data: {
          status_atual: StatusCandidatura.REPROVADO,
          notificacao_pendente: true,
        },
      });
    });
  }

  async obterPerfilCompleto(id_candidatura: number, id_empresa: number) {
    const candidatura = await prisma.candidatura.findUnique({
      where: { id_candidatura },
      include: {
        vaga: { include: { configuracao: true } },
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true } },
            endereco: true,
            areas_atuacao: true,
            experiencias: { orderBy: { data_inicio: "desc" } },
            formacoes: { orderBy: { data_conclusao: "desc" } },
            competencias: { include: { competencia: true } },
          },
        },
        respostas: true,
        agendamento: true,
        avaliacao: true,
      },
    });

    if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
      throw new Error("Acesso negado.");
    }

    // --- GATILHO DE VISUALIZAÇÃO ---
    // Se a candidatura ainda não foi visualizada, nós registramos agora!
    if (!candidatura.visualizada) {
      const agora = new Date();

      await prisma.candidatura.update({
        where: { id_candidatura },
        data: {
          visualizada: true,
          data_visualizacao: agora,
        },
      });

      // Atualizamos o objeto em memória para que o Front-end
      // já receba o status de 'visualizada: true' no JSON de resposta
      candidatura.visualizada = true;
      candidatura.data_visualizacao = agora;
    }

    // --- LÓGICA DO RESUMO ESTRATÉGICO ---
    const camposEscolhidos = (candidatura.vaga.configuracao
      ?.campos_destaque as string[]) || [
      "nome",
      "experiencia_recente",
      "cidade",
    ];

    const resumo: any = {};

    // Mapeamos os dados estratégicos conforme a escolha do recrutador
    if (camposEscolhidos.includes("experiencia_recente")) {
      resumo.experiencia_recente =
        candidatura.candidato.experiencias[0] || "Sem experiência registrada";
    }

    if (
      camposEscolhidos.includes("idade") &&
      candidatura.candidato.data_nascimento
    ) {
      const hoje = new Date();
      const nasc = new Date(candidatura.candidato.data_nascimento);
      let idade = hoje.getFullYear() - nasc.getFullYear();
      resumo.idade = idade;
    }

    if (camposEscolhidos.includes("localizacao")) {
      resumo.cidade_bairro = `${candidatura.candidato.endereco?.cidade} - ${candidatura.candidato.endereco?.bairro}`;
    }

    return {
      ...candidatura,
      resumo_estrategico: resumo, // O Front-end usa isso para o topo do modal
    };
  }

  async atualizarPreferenciaDestaque(
    id_vaga: number,
    id_empresa: number,
    campos: string[],
  ) {
    // Validação: A vaga pertence a esta empresa?
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
    });

    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");

    return await prisma.configuracaoVaga.upsert({
      where: { id_vaga },
      update: { campos_destaque: campos },
      create: {
        id_vaga,
        campos_destaque: campos,
      },
    });
  }

  /**
   * Salva ou atualiza a avaliação interna da empresa sobre o candidato
   */

  async avaliarCandidatura(
    id_candidatura: number,
    id_empresa: number,
    dados: {
      pontuacao?: number;
      observacoes_internas?: string;
      tags_avaliacao?: any;
    },
  ) {
    // Validação de segurança: a candidatura deve pertencer a uma vaga da empresa
    const candidatura = await prisma.candidatura.findFirst({
      where: { id_candidatura, vaga: { id_empresa } },
    });

    if (!candidatura)
      throw new Error("Ação não permitida ou candidatura não encontrada.");

    return await prisma.avaliacaoCandidatura.upsert({
      where: { id_candidatura },
      update: {
        // CORREÇÃO: Forçamos null se for undefined para cumprir o 'exactOptionalPropertyTypes'
        pontuacao: dados.pontuacao ?? null,
        observacoes_internas: dados.observacoes_internas ?? null,
        tags_avaliacao: dados.tags_avaliacao ?? null,
      },
      create: {
        id_candidatura,
        pontuacao: dados.pontuacao ?? null,
        observacoes_internas: dados.observacoes_internas ?? null,
        tags_avaliacao: dados.tags_avaliacao ?? null,
      },
    });
  }

  async obterHistoricoCandidatura(id_candidatura: number, id_empresa: number) {
    const candidatura = await prisma.candidatura.findFirst({
      where: {
        id_candidatura,
        vaga: { id_empresa },
      },
    });

    if (!candidatura)
      throw new Error("Candidatura não encontrada ou acesso negado.");

    return await prisma.movimentoCandidatura.findMany({
      where: { id_candidatura },
      orderBy: { criado_em: "desc" },
    });
  }

  async avancarEmMassa(id_candidaturas: number[], id_empresa: number) {
    return await prisma.$transaction(async (tx) => {
      const candidaturas = await tx.candidatura.findMany({
        where: {
          id_candidatura: { in: id_candidaturas },
          vaga: { id_empresa },
          status_atual: {
            notIn: ["REPROVADO", "DESISTENCIA"]
          }
        },
        select: { id_candidatura: true, id_etapa_atual: true, id_vaga: true },
      });

      if (candidaturas.length !== id_candidaturas.length) {
        throw new Error("Candidaturas inválidas ou sem permissão de acesso.");
      }

      if (candidaturas.length === 0) return { sucesso: true, avancados: 0 };

      // 2. REGRA DE NEGÓCIO: Para avançar em massa, todos devem ser da MESMA VAGA
      const idVaga = candidaturas[0]!.id_vaga;
      const todasMesmaVaga = candidaturas.every((c) => c.id_vaga === idVaga);

      if (!todasMesmaVaga) {
        throw new Error(
          "Para avançar em massa, selecione candidatos de uma única vaga.",
        );
      }

      // 3. Busca todas as etapas dessa vaga, ordenadas
      const etapasVaga = await tx.etapaProcesso.findMany({
        where: { id_vaga: idVaga },
        orderBy: { ordem: "asc" },
      });

      const movimentosParaCriar = [];
      const candidaturasParaAtualizar = []; // Usaremos Promise.all para as atualizações

      // 4. Calcula a próxima etapa para cada candidato
      for (const c of candidaturas) {
        const etapaAtual = etapasVaga.find(
          (e) => e.id_etapa === c.id_etapa_atual,
        );

        // Se não achar etapa atual ou se for a última etapa, pula esse candidato
        if (!etapaAtual) continue;

        const proximaEtapa = etapasVaga.find((e) => e.ordem > etapaAtual.ordem);
        if (!proximaEtapa) continue; // Já está na última etapa, não avança

        let novoStatus: StatusCandidatura = "TRIAGEM";
        if (proximaEtapa.tipo === "FINAL") novoStatus = "APROVADO";
        if (proximaEtapa.nome_etapa.toLowerCase().includes("entrevista"))
          novoStatus = "ENTREVISTA";

        // Prepara o histórico
        movimentosParaCriar.push({
          id_candidatura: c.id_candidatura,
          etapa_origem: c.id_etapa_atual,
          etapa_destino: proximaEtapa.id_etapa,
          status_destino: novoStatus,
          motivo: `Avançado em massa para a etapa: ${proximaEtapa.nome_etapa}`,
        });

        // Prepara o Update individual (pois cada um pode estar indo pra uma etapa diferente,
        // caso o recrutador tenha selecionado de colunas misturadas)
        candidaturasParaAtualizar.push(
          tx.candidatura.update({
            where: { id_candidatura: c.id_candidatura },
            data: {
              id_etapa_atual: proximaEtapa.id_etapa,
              status_atual: novoStatus,
              notificacao_pendente: !proximaEtapa.requer_agendamento,
            },
          }),
        );
      }

      // 5. Salva tudo de uma vez no banco
      if (movimentosParaCriar.length > 0) {
        await tx.movimentoCandidatura.createMany({ data: movimentosParaCriar });
        await Promise.all(candidaturasParaAtualizar);
      }

      return {
        sucesso: true,
        avancados: movimentosParaCriar.length,
        ignorados: candidaturas.length - movimentosParaCriar.length, // Pessoas que já estavam na última etapa
      };
    });
  }

  async listarHistoricoCompleto(id_usuario: number) {
    const candidaturas = await prisma.candidatura.findMany({
      where: { id_candidato: id_usuario },
      orderBy: { data_candidatura: "desc" }, // Da mais nova para a mais antiga
      include: {
        vaga: {
          select: {
            titulo: true,
            modelo_trabalho: true,
            tipo_contrato: true,
            empresa_confidencial: true,
            endereco: { select: { cidade: true, uf: true } },
            empresa: { select: { nome_fantasia: true, logotipo_url: true } },
          },
        },
        agendamento: true,

        // ✨ O Pulo do Gato para o Feedback:
        // Trazemos apenas a movimentação onde o cara foi Reprovado para pegar o "motivo"
        movimentacoes: {
          where: { status_destino: "REPROVADO" },
          orderBy: { criado_em: "desc" },
          take: 1,
          select: { motivo: true },
        },
      },
    });

    // Mapeamento e Blindagem de Dados
    return candidaturas.map((c) => {
      const isConfidencial = c.vaga.empresa_confidencial;
      const endereco = c.vaga.endereco;

      return {
        id_candidatura: c.id_candidatura,
        data_inscricao: c.data_candidatura,
        status: c.status_atual,

        // Agrupamos os dados da vaga para ficar organizado no Front-end
        vaga: {
          titulo: c.vaga.titulo,
          modelo_trabalho: c.vaga.modelo_trabalho,
          tipo_contrato: c.vaga.tipo_contrato,

          // Lógica de localização limpa
          localizacao:
            c.vaga.modelo_trabalho === "REMOTO"
              ? "Remoto"
              : endereco
                ? `${endereco.cidade} - ${endereco.uf}`
                : "Não informada",

          // Blindagem da empresa
          empresa_nome: isConfidencial
            ? "Empresa Confidencial"
            : c.vaga.empresa.nome_fantasia,
          empresa_logo: isConfidencial ? null : c.vaga.empresa.logotipo_url,
        },

        // Só manda agendamento se estiver na fase de entrevista
        agendamento:
          c.status_atual === "ENTREVISTA" && c.agendamento
            ? {
                data_hora: c.agendamento.data_hora,
                local_link: c.agendamento.local_link,
                observacoes: c.agendamento.observacoes,
              }
            : null,

        feedback_reprovacao:
          c.status_atual === "REPROVADO" && c.movimentacoes.length > 0
            ? c.movimentacoes[0]?.motivo
            : null,
      };
    });
  }

  async desistirCandidatura(id_candidatura: number, id_usuario: number) {
    // 1. Busca a candidatura para garantir que existe e é da pessoa certa
    const candidatura = await prisma.candidatura.findUnique({
      where: { id_candidatura },
      select: {
        id_candidato: true,
        status_atual: true,
        id_etapa_atual: true,
      },
    });

    if (!candidatura) {
      throw new Error("Candidatura não encontrada.");
    }

    // 🔒 TRAVA DE SEGURANÇA: O cara está tentando cancelar a candidatura do amiguinho?
    if (candidatura.id_candidato !== id_usuario) {
      throw new Error("Você não tem permissão para alterar esta candidatura.");
    }

    // 2. Verifica se a candidatura já está num status final
    if (
      ["REPROVADO", "DESISTENCIA", "APROVADO"].includes(
        candidatura.status_atual,
      )
    ) {
      throw new Error(
        `Não é possível cancelar uma candidatura que já está com status: ${candidatura.status_atual}`,
      );
    }

    // 3. A Transação (Tudo ou nada)
    return await prisma.$transaction(async (tx) => {
      // Atualiza o status principal para DESISTENCIA
      const atualizada = await tx.candidatura.update({
        where: { id_candidatura },
        data: {
          status_atual: "DESISTENCIA",
        },
      });

      // Registra o movimento para a empresa ter o histórico de que foi o candidato quem saiu
      await tx.movimentoCandidatura.create({
        data: {
          id_candidatura: id_candidatura,
          etapa_origem: candidatura.id_etapa_atual,
          etapa_destino: candidatura.id_etapa_atual, // Fica na mesma etapa, só muda o status
          status_destino: "DESISTENCIA",
          motivo: "Desistência informada pelo candidato através do painel.",
        },
      });

      return atualizada;
    });
  }

  async listarMeusAgendamentos(id_usuario: number) {
    const agendamentos = await prisma.agendamentoEntrevista.findMany({
      where: {
        // Busca os agendamentos que pertencem às candidaturas deste usuário
        candidatura: {
          id_candidato: id_usuario,
          // Filtro de Limpeza: Ignora se o processo já acabou para ele
          status_atual: {
            notIn: ["DESISTENCIA", "REPROVADO"],
          },
        },
      },
      // Ordena pela data: As entrevistas mais próximas do dia de hoje aparecem primeiro no array
      orderBy: {
        data_hora: "asc",
      },
      // Trazemos os dados da vaga e da empresa para montar o "Card de Entrevista"
      include: {
        candidatura: {
          select: {
            id_candidatura: true,
            status_atual: true,
            vaga: {
              select: {
                titulo: true,
                empresa_confidencial: true,
                empresa: {
                  select: { nome_fantasia: true, logotipo_url: true },
                },
              },
            },
          },
        },
      },
    });

    // Mapeamento e blindagem da empresa confidencial
    return agendamentos.map((ag) => {
      const isConfidencial = ag.candidatura.vaga.empresa_confidencial;

      return {
        id_agendamento: ag.id_agendamento,
        id_candidatura: ag.candidatura.id_candidatura,

        // 📅 Os dados de Ouro:
        data_hora: ag.data_hora,
        local_link: ag.local_link,
        observacoes: ag.observacoes,

        // Contexto para o candidato não esquecer qual é a vaga
        vaga_titulo: ag.candidatura.vaga.titulo,
        empresa_nome: isConfidencial
          ? "Empresa Confidencial"
          : ag.candidatura.vaga.empresa.nome_fantasia,
        empresa_logo: isConfidencial
          ? null
          : ag.candidatura.vaga.empresa.logotipo_url,
        status_candidatura: ag.candidatura.status_atual,
      };
    });
  }

  async verificarInscricao(id_candidato: number, id_vaga: number) {
    // Busca se existe qualquer registro de candidatura desse usuário para esta vaga
    const candidatura = await prisma.candidatura.findFirst({
      where: {
        id_candidato: id_candidato,
        id_vaga: id_vaga,
      },
      select: {
        status_atual: true, // Pega o status para o Front-end poder usar
      },
    });

    // Se 'candidatura' existir, inscrito = true. Se for null, inscrito = false.
    return {
      inscrito: !!candidatura,
      status: candidatura ? candidatura.status_atual : null,
    };
  }
}
