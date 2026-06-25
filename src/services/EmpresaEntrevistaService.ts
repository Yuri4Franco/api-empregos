import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export class EmpresaEntrevistaService {
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
}
