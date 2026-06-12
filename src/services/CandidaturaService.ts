import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { StatusCandidatura } from "@prisma/client";

export class CandidaturaService {
  async obterPainelGestao(id_vaga: number, id_empresa: number) {
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

    // ✨ Busca na tabela de movimentos
    // Usamos o groupBy para saber quantos candidatos únicos têm pendências
    const pendentesPorCandidato = await prisma.movimentoCandidatura.groupBy({
      by: ["id_candidatura"],
      where: {
        notificacao_pendente: true,
        candidatura: {
          id_vaga: Number(id_vaga),
          vaga: { id_empresa }, // Segurança extra: garante que a vaga é da empresa
        },
      },
    });

    const totalNotificacoesPendentes = pendentesPorCandidato.length;

    return {
      vaga: { titulo: vaga.titulo, status: vaga.status },
      // ✨ MUDANÇA: Colocamos o total na RAIZ do objeto!
      total_notificacoes_pendentes: totalNotificacoesPendentes,

      // As colunas agora servem perfeitamente como as "Abas" da sua nova lista
      colunas: vaga.etapas.map((etapa) => ({
        id_etapa: etapa.id_etapa,
        nome_etapa: etapa.nome_etapa,
        ordem: etapa.ordem,
        tipo: etapa.tipo,
        requer_agendamento: etapa.requer_agendamento,
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
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Validações iniciais
      const candidatura = await tx.candidatura.findUnique({
        where: { id_candidatura },
        include: { vaga: { select: { id_empresa: true } } },
      });

      if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
        throw new Error("Candidatura não encontrada ou acesso negado.");
      }

      // 2. Busca TODAS as etapas dessa vaga para termos o "mapa" completo
      const etapasVaga = await tx.etapaProcesso.findMany({
        where: { id_vaga: candidatura.id_vaga },
      });

      const etapaOrigem = etapasVaga.find(
        (e) => e.id_etapa === candidatura.id_etapa_atual,
      );
      const etapaDestino = etapasVaga.find(
        (e) => e.id_etapa === id_etapa_destino,
      );

      if (!etapaOrigem || !etapaDestino) {
        throw new Error("Etapa inválida para esta vaga.");
      }

      let novoStatus: StatusCandidatura = "TRIAGEM";
      if (etapaDestino.tipo === "FINAL") novoStatus = "APROVADO";
      if (etapaDestino.nome_etapa.toLowerCase().includes("entrevista")) {
        novoStatus = "ENTREVISTA";
      }

      // ====================================================================
      // 🧠 A LÓGICA DA "MARCA D'ÁGUA MÁXIMA" (High Water Mark)
      // Precisamos saber qual foi o ponto mais longe que o candidato já chegou.
      // ====================================================================
      const historico = await tx.movimentoCandidatura.findMany({
        where: { id_candidatura },
        select: { etapa_destino: true },
      });

      let maiorOrdemAlcancada = etapaOrigem.ordem; // No mínimo, ele chegou onde está agora

      // Varremos o histórico para descobrir o recorde
      for (const mov of historico) {
        const etapaDoHistorico = etapasVaga.find(
          (e) => e.id_etapa === mov.etapa_destino,
        );
        if (etapaDoHistorico && etapaDoHistorico.ordem > maiorOrdemAlcancada) {
          maiorOrdemAlcancada = etapaDoHistorico.ordem;
        }
      }

      // 4. O VEREDITO: É um avanço inédito?
      // Só é avanço real se ele está indo para uma ordem MAIOR do que o seu próprio recorde.
      const isAvancoInedito = etapaDestino.ordem > maiorOrdemAlcancada;

      // E só entra na fila se for inédito E não exigir agendamento manual
      const deveNotificar = isAvancoInedito && !etapaDestino.requer_agendamento;

      // 5. Registra o evento com a decisão final
      await tx.movimentoCandidatura.create({
        data: {
          id_candidatura,
          etapa_origem: candidatura.id_etapa_atual,
          etapa_destino: id_etapa_destino,
          status_destino: novoStatus,
          motivo: isAvancoInedito
            ? `Avançou para a etapa: ${etapaDestino.nome_etapa}`
            : `Movido para a etapa: ${etapaDestino.nome_etapa} (Revisão/Correção)`,
          notificacao_pendente: deveNotificar,
        },
      });

      // 6. Atualiza o candidato fisicamente
      return await tx.candidatura.update({
        where: { id_candidatura },
        data: {
          id_etapa_atual: id_etapa_destino,
          status_atual: novoStatus,
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
      id_empresa,
    );
  }

  async agendarEntrevista(
    id_candidatura: number,
    id_empresa: number,
    dados: { data_hora: Date; local_link: string; observacoes?: string },
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Validar se a empresa é dona da vaga do candidato
      const candidatura = await tx.candidatura.findUnique({
        where: { id_candidatura },
        include: { vaga: { select: { id_empresa: true } } },
      });

      if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
        throw new Error("Candidatura não encontrada ou acesso negado.");
      }

      // 2. Criar ou atualizar o agendamento
      const agendamento = await tx.agendamentoEntrevista.upsert({
        where: { id_candidatura },
        create: {
          id_candidatura,
          data_hora: dados.data_hora,
          local_link: dados.local_link,
          observacoes: dados.observacoes ?? null,
        },
        update: {
          data_hora: dados.data_hora,
          local_link: dados.local_link,
          observacoes: dados.observacoes ?? null,
        },
      });

      // Formata a data para ficar bonita no histórico
      const dataFormatada = new Date(dados.data_hora).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });

      // 3. Após agendar, criamos um EVENTO na linha do tempo com a pendência
      // Assim o candidato continua na mesma etapa, mas a notificação entra na fila!
      await tx.movimentoCandidatura.create({
        data: {
          id_candidatura: id_candidatura,
          etapa_origem: candidatura.id_etapa_atual,
          etapa_destino: candidatura.id_etapa_atual, // Permanece onde está
          status_destino: candidatura.status_atual, // Mantém o status
          motivo: `Entrevista agendada para: ${dataFormatada}`,
          notificacao_pendente: true, // 🚀 Libera para o recrutador disparar o alerta!
        },
      });

      return agendamento;
    });
  }

  async processarNotificacoesPendentes(id_vaga: number, id_empresa: number) {
    const movimentosPendentes = await prisma.movimentoCandidatura.findMany({
      where: {
        notificacao_pendente: true,
        candidatura: {
          id_vaga,
          vaga: { id_empresa },
        },
      },
      orderBy: { criado_em: "asc" },
      include: {
        candidatura: {
          include: {
            candidato: { include: { usuario: true } },
            agendamento: true,
            // 🚀 CORREÇÃO: Trazemos as etapas da vaga para descobrir o nome depois!
            vaga: {
              select: { etapas: true },
            },
          },
        },
      },
    });

    if (movimentosPendentes.length === 0) return [];

    const movimentosFinais = new Map();

    for (const mov of movimentosPendentes) {
      // Cruzamos os dados em memória para achar o nome da etapa de destino
      const etapa = mov.candidatura.vaga.etapas.find(
        (e) => e.id_etapa === mov.etapa_destino,
      );

      // Injetamos um campo novo no objeto para o seu Controller usar fácil no disparo de email
      const movimentoComNomeDaEtapa = {
        ...mov,
        nome_etapa_destino: etapa ? etapa.nome_etapa : "Nova Etapa",
      };

      movimentosFinais.set(mov.id_candidatura, movimentoComNomeDaEtapa);
    }

    const listaParaNotificar = Array.from(movimentosFinais.values());
    const idsMovimentos = movimentosPendentes.map((m) => m.id_movimento);

    await prisma.movimentoCandidatura.updateMany({
      where: { id_movimento: { in: idsMovimentos } },
      data: { notificacao_pendente: false },
    });

    return listaParaNotificar;
  }

  async reprovarEmMassa(
    id_candidaturas: any[], // Aceita 'any' temporariamente para forçar a conversão segura
    motivo: string,
    id_empresa: number,
  ) {
    // 1. Garantir que os IDs sejam numéricos (o Express as vezes envia como string)
    const idsNumericos = id_candidaturas.map((id) => Number(id));

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 2. Busca apenas as candidaturas que REALMENTE podem ser reprovadas
      const candidaturasValidas = await tx.candidatura.findMany({
        where: {
          id_candidatura: { in: idsNumericos },
          vaga: { id_empresa },
          status_atual: {
            notIn: ["REPROVADO", "DESISTENCIA"],
          },
        },
        select: { id_candidatura: true, id_etapa_atual: true },
      });

      // 3. Se o RH selecionou uma lista, mas TODOS já estavam reprovados, avisamos:
      if (candidaturasValidas.length === 0) {
        throw new Error(
          "Nenhuma candidatura selecionada é válida para reprovação (talvez já tenham sido reprovadas).",
        );
      }

      // Separamos apenas os IDs que passaram na peneira
      const idsFiltrados = candidaturasValidas.map((c) => c.id_candidatura);

      // 4. Salva a movimentação do histórico
      await tx.movimentoCandidatura.createMany({
        data: candidaturasValidas.map((c) => ({
          id_candidatura: c.id_candidatura,
          etapa_origem: c.id_etapa_atual,
          etapa_destino: c.id_etapa_atual, // Estaciona na etapa atual
          status_destino: "REPROVADO", // O enum correto pode ser passado direto
          motivo: motivo || "Reprovação em lote",
          // notificacao_pendente: true // O Prisma já aplica @default(true) neste model automaticamente!
        })),
      });

      // 5. Atualiza o status das candidaturas validadas
      return await tx.candidatura.updateMany({
        where: { id_candidatura: { in: idsFiltrados } },
        data: {
          status_atual: "REPROVADO",
          // 🚨 IMPORTANTE: Removi o "notificacao_pendente: true" daqui pois ele não existe no model Candidatura!
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
    // 1. Buscamos a candidatura TUDO o que está atrelado a ela
    const candidatura = await prisma.candidatura.findFirst({
      where: {
        id_candidatura,
        vaga: { id_empresa },
      },
      include: {
        movimentacoes: true, // Traz os movimentos do Kanban/Lista
        agendamento: true, // Traz a entrevista (se houver)
        avaliacao: true, // Traz as estrelinhas e notas (se houver)
      },
    });

    if (!candidatura)
      throw new Error("Candidatura não encontrada ou acesso negado.");

    // 2. Criamos um Array vazio para empilhar os eventos
    const eventos = [];

    // --- EVENTO A: A INSCRIÇÃO ---
    eventos.push({
      id_evento: `insc_${candidatura.id_candidatura}`,
      tipo: "INSCRICAO",
      titulo: "Candidatura Recebida",
      descricao: "O candidato enviou o currículo para esta vaga.",
      data_hora: candidatura.data_candidatura,
    });

    // --- EVENTO B: A VISUALIZAÇÃO ---
    if (candidatura.visualizada && candidatura.data_visualizacao) {
      eventos.push({
        id_evento: `view_${candidatura.id_candidatura}`,
        tipo: "VISUALIZACAO",
        titulo: "Currículo Visualizado",
        descricao: "Você abriu o perfil do candidato pela primeira vez.",
        data_hora: candidatura.data_visualizacao,
      });
    }

    // --- EVENTO C: AS MOVIMENTAÇÕES DE ETAPA ---
    candidatura.movimentacoes.forEach((mov) => {
      eventos.push({
        id_evento: `mov_${mov.id_movimento}`,
        tipo: "MOVIMENTACAO",
        titulo: "Avanço de Etapa",
        descricao: `Candidato foi movido para o status: ${mov.status_destino}.`,
        data_hora: mov.criado_em,
      });
    });

    // --- EVENTO D: A AVALIAÇÃO ---
    if (candidatura.avaliacao) {
      eventos.push({
        id_evento: `aval_${candidatura.avaliacao.id_avaliacao}`,
        tipo: "AVALIACAO",
        titulo: "Candidato Avaliado",
        descricao: `Recebeu ${candidatura.avaliacao.pontuacao || "nota"} estrelas.`,
        data_hora: candidatura.avaliacao.criado_em,
      });
    }

    // --- EVENTO E: A ENTREVISTA ---
    if (candidatura.agendamento) {
      eventos.push({
        id_evento: `agen_${candidatura.agendamento.id_agendamento}`,
        tipo: "AGENDAMENTO",
        titulo: "Entrevista Agendada",
        descricao: `Marcada para ${new Date(candidatura.agendamento.data_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        data_hora: candidatura.agendamento.criado_em, // Usamos a data que o RH CRIOU o agendamento para a timeline
      });
    }

    // 3. Ordenamos TUDO do mais recente para o mais antigo (Decrescente)
    eventos.sort(
      (a, b) =>
        new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime(),
    );

    return eventos;
  }

  async obterHistoricoVaga(id_vaga: number, id_empresa: number) {
    // 1. Validação de segurança: a vaga pertence a essa empresa?
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
    });

    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");

    // 2. Busca os logs relacionados a esta vaga
    const logs = await prisma.logAuditoria.findMany({
      where: {
        entidade: "VAGA",
        id_entidade: id_vaga,
      },
      include: {
        usuario: { select: { nome: true } },
      },
      orderBy: { criado_em: "desc" },
    });

    // 3. Mapeamento para formato de Timeline
    return logs.map((log) => {
      const detalhes = log.detalhes as any;
      let titulo = "Atividade na Vaga";
      let descricao = log.acao;
      let tipo = "INFO";

      // Lógica para deixar as mensagens "humanas"
      switch (log.acao) {
        case "CREATE":
          tipo = "CRIACAO";
          titulo = "Vaga Criada";
          descricao = `Vaga iniciada como ${detalhes?.status || "Rascunho"} por ${log.usuario.nome}.`;
          break;

        case "UPDATE_STATUS":
          tipo = "STATUS";
          titulo = "Status Alterado";
          descricao = `Status alterado de ${detalhes?.antigo} para ${detalhes?.novo}.`;
          break;

        case "UPDATE":
          tipo = "EDICAO";
          titulo = "Vaga Atualizada";
          // Se você salvar nos detalhes quais campos mudaram, pode listar aqui
          descricao = detalhes?.campos
            ? `Campos editados: ${detalhes.campos.join(", ")}.`
            : `Informações da vaga foram atualizadas por ${log.usuario.nome}.`;
          break;

        case "CLOSE":
          tipo = "ENCERRAMENTO";
          titulo = "Vaga Encerrada";
          descricao = "A vaga foi finalizada e não aceita mais candidaturas.";
          break;
      }

      return {
        id_log: log.id_log,
        tipo,
        titulo,
        descricao,
        usuario: log.usuario.nome,
        data_hora: log.criado_em,
      };
    });
  }

  async avancarEmMassa(id_candidaturas: number[], id_empresa: number) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const candidaturas = await tx.candidatura.findMany({
        where: {
          id_candidatura: { in: id_candidaturas },
          vaga: { id_empresa },
          status_atual: {
            notIn: ["REPROVADO", "DESISTENCIA"],
          },
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

      // ✨ BUSCA DE ALTA PERFORMANCE DO HISTÓRICO (Para a regra do "Recorde")
      // Pega todos os movimentos desses candidatos de uma vez só
      const historicosGerais = await tx.movimentoCandidatura.findMany({
        where: { id_candidatura: { in: id_candidaturas } },
        select: { id_candidatura: true, etapa_destino: true },
      });

      // Mapeia o "Recorde" (maior ordem alcançada) de cada candidato
      const recordes = new Map<number, number>();
      for (const hist of historicosGerais) {
        const etapaDoHistorico = etapasVaga.find(
          (e) => e.id_etapa === hist.etapa_destino,
        );
        if (etapaDoHistorico) {
          const recordeAtual = recordes.get(hist.id_candidatura) || 0;
          if (etapaDoHistorico.ordem > recordeAtual) {
            recordes.set(hist.id_candidatura, etapaDoHistorico.ordem);
          }
        }
      }

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

        // ✨ AVALIAÇÃO DA NOTIFICAÇÃO (High Water Mark)
        // Garante que o recorde nunca seja menor que a etapa onde ele já estava fisicamente
        const recordeHistorico = Math.max(
          recordes.get(c.id_candidatura) || 0,
          etapaAtual.ordem,
        );
        const isAvancoInedito = proximaEtapa.ordem > recordeHistorico;
        const deveNotificar =
          isAvancoInedito && !proximaEtapa.requer_agendamento;

        // Prepara o histórico (✨ A NOTIFICAÇÃO PENDENTE VEM PRA CÁ!)
        movimentosParaCriar.push({
          id_candidatura: c.id_candidatura,
          etapa_origem: c.id_etapa_atual,
          etapa_destino: proximaEtapa.id_etapa,
          status_destino: novoStatus,
          motivo: isAvancoInedito
            ? `Avançado em massa para a etapa: ${proximaEtapa.nome_etapa}`
            : `Movido em massa para a etapa: ${proximaEtapa.nome_etapa} (Revisão)`,
          notificacao_pendente: deveNotificar,
        });

        // Prepara o Update individual
        candidaturasParaAtualizar.push(
          tx.candidatura.update({
            where: { id_candidatura: c.id_candidatura },
            data: {
              id_etapa_atual: proximaEtapa.id_etapa,
              status_atual: novoStatus,
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
        // ✨ O NOVO Pulo do Gato: Trazemos TODO o histórico de movimentações da candidatura
        movimentacoes: {
          orderBy: { criado_em: "asc" }, // Crescente para montar a linha do tempo (timeline)
          select: {
            id_movimento: true,
            status_destino: true,
            motivo: true,
            criado_em: true,
          },
        },
      },
    });

    // Mapeamento e Blindagem de Dados
    return candidaturas.map((c) => {
      const isConfidencial = c.vaga.empresa_confidencial;
      const endereco = c.vaga.endereco;

      // Pegamos a última movimentação para extrair o feedback caso ele tenha sido reprovado
      const ultimaMovimentacao =
        c.movimentacoes.length > 0
          ? c.movimentacoes[c.movimentacoes.length - 1]
          : null;

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

        // Mandamos o array de movimentações para a Timeline do Frontend
        movimentacoes: c.movimentacoes,

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
          c.status_atual === "REPROVADO" &&
          ultimaMovimentacao?.status_destino === "REPROVADO"
            ? ultimaMovimentacao.motivo
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
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    // 🕒 Lógica para pegar o início do dia atual (00:00:00)
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const agendamentos = await prisma.agendamentoEntrevista.findMany({
      where: {
        // 🔥 FILTRO: Mostra agendamentos de HOJE (desde as 00:00) em diante
        data_hora: {
          gte: inicioDoDia,
        },

        // Busca os agendamentos que pertencem às candidaturas deste usuário
        candidatura: {
          id_candidato: id_usuario,
          // Filtro de Limpeza: Ignora se o processo já acabou para ele
          status_atual: {
            notIn: ["DESISTENCIA", "REPROVADO"],
          },
        },
      },
      // Ordena pela data: As entrevistas mais próximas do dia de hoje aparecem primeiro
      orderBy: {
        data_hora: "asc",
      },
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

    return agendamentos.map((ag) => {
      const isConfidencial = ag.candidatura.vaga.empresa_confidencial;

      return {
        id_agendamento: ag.id_agendamento,
        id_candidatura: ag.candidatura.id_candidatura,
        data_hora: ag.data_hora,
        local_link: ag.local_link,
        observacoes: ag.observacoes,
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
