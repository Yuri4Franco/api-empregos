import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { StatusCandidatura } from "@prisma/client";

export class CandidatoCandidaturaService {

  // função do candidato
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

  // função do candidato
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

  // função do candidato
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

  // função do candidato
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

  // função do candidato
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
