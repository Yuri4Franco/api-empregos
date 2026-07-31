import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { EmailService } from "../services/EmailService.js"; // ✨ Importando o serviço

export class EmpresaEntrevistaService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService(); // ✨ Instanciando o serviço
  }

  async agendarEntrevista(
    id_candidatura: number,
    id_empresa: number,
    dados: { data_hora: Date; local_link: string; observacoes?: string },
  ) {
    // Variável para armazenar os dados do e-mail e disparar fora da transação
    let dadosParaEmail: any = null;

    const agendamento = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. Validar se a empresa é dona da vaga e trazer dados do candidato para o e-mail
        const candidatura = await tx.candidatura.findUnique({
          where: { id_candidatura },
          include: {
            vaga: {
              select: {
                id_empresa: true,
                titulo: true, // ✨ Buscando título da vaga
                empresa: {
                  select: { nome_fantasia: true, razao_social: true },
                }, // ✨ Buscando nome da empresa
              },
            },
            candidato: {
              include: {
                usuario: {
                  // ✨ Buscando nome, email e nossa nova flag de segurança!
                  select: { nome: true, email: true, email_confirmado: true },
                },
              },
            },
          },
        });

        if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
          throw new Error("Candidatura não encontrada ou acesso negado.");
        }

        // 2. Criar ou atualizar o agendamento
        const agendamentoDb = await tx.agendamentoEntrevista.upsert({
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

        // Formata a data para ficar bonita no histórico e no e-mail
        const dataFormatada = new Date(dados.data_hora).toLocaleString(
          "pt-BR",
          {
            timeZone: "America/Sao_Paulo",
          },
        );

        // 3. Após agendar, criamos um EVENTO na linha do tempo com a pendência
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

        // ✨ 4. Validação de segurança: Prepara o e-mail apenas se estiver confirmado
        const usuario = candidatura.candidato.usuario;
        if (usuario.email && usuario.email_confirmado) {
          dadosParaEmail = {
            email: usuario.email,
            nome: usuario.nome,
            tituloVaga: candidatura.vaga.titulo,
            nomeEmpresa:
              candidatura.vaga.empresa.nome_fantasia ||
              candidatura.vaga.empresa.razao_social,
            dataFormatada,
            localLink: dados.local_link,
            observacoes: dados.observacoes,
          };
        }

        return agendamentoDb;
      },
    );

    // ✨ 5. Disparo do e-mail FORA da transação (Evita bloqueio do banco de dados)
    if (dadosParaEmail) {
      await this.emailService
        .enviarEmailAgendamento(
          dadosParaEmail.email,
          dadosParaEmail.nome,
          dadosParaEmail.tituloVaga,
          dadosParaEmail.nomeEmpresa,
          dadosParaEmail.dataFormatada,
          dadosParaEmail.localLink,
          dadosParaEmail.observacoes,
        )
        .catch((err) => {
          // Apenas logamos o erro para não quebrar o retorno da API para o Front-end
          console.error("[EntrevistaService] Erro ao enfileirar e-mail:", err);
        });
    }

    return agendamento;
  }
}
