import { prisma } from "../config/prisma.js";
import { StatusCandidatura } from "@prisma/client";

export class CandidaturaService {
  async candidatar(
    id_vaga: number,
    id_candidato: number,
    respostas: { id_pergunta: number; resposta: any }[],
  ) {
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

    const respostasFormatadas = vaga.perguntas_eliminatorias.map(
      (perguntaVaga) => {
        const respCandidato = respostas.find(
          (r) => r.id_pergunta === perguntaVaga.id_pergunta,
        );

        // Se a pergunta era obrigatória e não veio resposta, tratamos como fora do perfil
        const valorRespostaStr = String(respCandidato?.resposta ?? "");

        const isForaDoPerfil =
          valorRespostaStr !== perguntaVaga.resposta_esperada;

        if (isForaDoPerfil) reprovadoNaTriagem = true;

        return {
          id_pergunta: perguntaVaga.id_pergunta,
          resposta: valorRespostaStr,
          fora_do_perfil: isForaDoPerfil,
        };
      },
    );

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
        respostas: {
          create: respostasFormatadas,
        },
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
      // 1. Buscar a candidatura atual com os dados da Vaga para a notificação
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
