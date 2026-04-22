import { prisma } from "../config/prisma.js";
import { StatusCandidatura } from "@prisma/client";

export class CandidaturaService {
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

  async moverCandidato(dados: {
    id_candidatura: number;
    id_etapa_destino: number;
    status_destino: StatusCandidatura;
    motivo?: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      const candidatura = await tx.candidatura.findUnique({
        where: { id_candidatura: dados.id_candidatura },
        include: {
          vaga: { select: { titulo: true } },
          candidato: { select: { id_usuario: true } },
        },
      });

      if (!candidatura) throw new Error("Candidatura não encontrada.");

      // 2. Atualizar a Candidatura
      const candidaturaAtualizada = await tx.candidatura.update({
        where: { id_candidatura: dados.id_candidatura },
        data: {
          id_etapa_atual: dados.id_etapa_destino,
          status_atual: dados.status_destino,
          notificacao_pendente: true, // Marcamos que há algo novo para o candidato ver
        },
      });

      // 3. Registrar o Movimento (Histórico)
      await tx.movimentoCandidatura.create({
        data: {
          id_candidatura: dados.id_candidatura,
          etapa_origem: candidatura.id_etapa_atual,
          etapa_destino: dados.id_etapa_destino,
          status_destino: dados.status_destino,
          motivo: dados.motivo ?? null,
        },
      });

      // 4. CRIAR A NOTIFICAÇÃO PARA O CANDIDATO
      const mensagem = `Houve uma atualização no seu status para a vaga "${candidatura.vaga.titulo}". Confira seu painel!`;

      await tx.notificacao.create({
        data: {
          id_usuario: candidatura.id_candidato,
          titulo: "Atualização de Candidatura",
          mensagem: mensagem,
          lida: false,
        },
      });

      return candidaturaAtualizada;
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

    // 5. Descobrir qual será o status baseado na próxima etapa
    // (A mesma inteligência que você já tinha criado antes)
    let novoStatus: StatusCandidatura = "TRIAGEM";
    if (proximaEtapa.tipo === "FINAL") novoStatus = "APROVADO";
    if (proximaEtapa.nome_etapa.toLowerCase().includes("entrevista")) {
      novoStatus = "ENTREVISTA";
    }

    // 6. Finalmente, chama a função passando EXATAMENTE o objeto que ela espera
    return await this.moverCandidato({
      id_candidatura: id_candidatura,
      id_etapa_destino: proximaEtapa.id_etapa,
      status_destino: novoStatus,
      motivo: `Avançado para a próxima etapa: ${proximaEtapa.nome_etapa}`,
    });
  }

  async avancarEmMassa(id_candidaturas: number[], id_empresa: number) {
    return await prisma.$transaction(async (tx) => {
      const candidaturas = await tx.candidatura.findMany({
        where: {
          id_candidatura: { in: id_candidaturas },
          vaga: { id_empresa }, // Trava de segurança da empresa
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

  async desistirCandidatura(id_candidatura: number, id_candidato: number) {
    // 1. Validar se a candidatura pertence ao usuário logado
    const candidatura = await prisma.candidatura.findFirst({
      where: { id_candidatura, id_candidato },
    });

    if (!candidatura) throw new Error("Candidatura não encontrada.");

    // 2. Atualizar para o status de DESISTENCIA
    return await prisma.candidatura.update({
      where: { id_candidatura },
      data: { status_atual: "DESISTENCIA" },
    });
  }
}
