import { prisma } from "../config/prisma.js";
import { StatusCandidatura } from "@prisma/client";

export class CandidatoService {
  // --- KANBAN E LISTAGEM ---
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
            area_atuacao: true,
          },
        },
        respostas: true,
        agendamento: true, // Incluímos o agendamento para visualização no card
      },
    });

    return {
      vaga: { titulo: vaga.titulo, status: vaga.status },
      colunas: vaga.etapas.map((etapa) => ({
        ...etapa,
        candidatos: candidaturas
          .filter((c) => c.id_etapa_atual === etapa.id_etapa)
          .map((c) => ({
            id_candidatura: c.id_candidatura,
            nome: c.candidato.usuario.nome,
            id_usuario: c.id_candidato,
            fora_do_perfil: c.respostas.some((r) => r.fora_do_perfil),
            data_inscricao: c.data_candidatura,
            possui_agendamento: !!c.agendamento,
            data_entrevista: c.agendamento?.data_hora || null,
          })),
      })),
    };
  }

  // --- MOVIMENTAÇÃO ---
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

      // Regra: Se a etapa requer agendamento, a notificação fica travada (false)
      const podeNotificarStatus = !etapaDestino.requer_agendamento;

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
          // Se requer agendamento, resetamos a flag até que o agendamento ocorra
          notificacao_pendente: podeNotificarStatus,
        },
      });
    });
  }

  // --- AGENDAMENTO (NOVO) ---
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
  // --- SAFE SEND E REPROVAÇÃO ---
  async processarNotificacoesPendentes(id_vaga: number, id_empresa: number) {
    const pendentes = await prisma.candidatura.findMany({
      where: {
        id_vaga,
        notificacao_pendente: true,
        vaga: { id_empresa },
      },
    });

    // Simulação de disparo de e-mails/notificações [cite: 260]
    return await prisma.candidatura.updateMany({
      where: { id_candidatura: { in: pendentes.map((p) => p.id_candidatura) } },
      data: { notificacao_pendente: false },
    });
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
        },
        select: { id_candidatura: true, id_etapa_atual: true },
      });

      if (candidaturas.length !== id_candidaturas.length) {
        throw new Error("Candidaturas inválidas.");
      }

      await tx.movimentoCandidatura.createMany({
        data: candidaturas.map((c) => ({
          id_candidatura: c.id_candidatura,
          etapa_origem: c.id_etapa_atual ?? null,
          etapa_destino: 0,
          status_destino: StatusCandidatura.REPROVADO,
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
            endereco: { include: { bairro: true } },
            area_atuacao: true,
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
      resumo.cidade_bairro = `${candidatura.candidato.endereco?.cidade} - ${candidatura.candidato.endereco?.bairro?.nome}`;
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
}
