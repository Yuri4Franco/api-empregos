import { prisma } from "../config/prisma.js";
import { StatusCandidatura } from "@prisma/client";

export class CandidaturaService {
  async candidatar(
    id_vaga: number,
    id_candidato: number,
    respostas: { id_pergunta: number; resposta: boolean }[],
  ) {
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

    let reprovadoNaTriagem = false;
    const respostasFormatadas = vaga.perguntas_eliminatorias.map(
      (perguntaVaga) => {
        const respCandidato = respostas.find(
          (r) => r.id_pergunta === perguntaVaga.id_pergunta,
        );
        const valorRespostaStr = String(respCandidato?.resposta || "false");

        // Verifica se a resposta do candidato é diferente da esperada pela vaga
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

    const primeiraEtapa = vaga.etapas[0]?.id_etapa;

    if (!primeiraEtapa) {
      throw new Error(
        "Esta vaga não possui etapas de seleção configuradas. Contate o administrador.",
      );
    }

    return await prisma.candidatura.create({
      data: {
        id_vaga,
        id_candidato,
        id_etapa_atual: primeiraEtapa,
        status_atual: reprovadoNaTriagem
          ? StatusCandidatura.REPROVADO
          : StatusCandidatura.INSCRITO,
        data_candidatura: new Date(),
        respostas: {
          create: respostasFormatadas,
        },
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
}
