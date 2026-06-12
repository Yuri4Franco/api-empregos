import cron from "node-cron";
import { prisma } from "../config/prisma.js"; // Ajuste o caminho se necessário
import { EmailService } from "../services/EmailService.js"; // Ajuste o caminho se necessário

const emailService = new EmailService();

export const agendarLimpezaContasPendentes = () => {
  cron.schedule("0 3 * * *", async () => {
    console.log("Iniciando rotina de higiene de contas pendentes...");

    const hoje = new Date();

    const limiteAviso = new Date(hoje);
    limiteAviso.setDate(hoje.getDate() - 25);

    const limiteExclusao = new Date(hoje);
    limiteExclusao.setDate(hoje.getDate() - 30);

    const usuariosParaAvisar = await prisma.usuario.findMany({
      where: {
        status: "PENDENTE",
        tipo_usuario: "CANDIDATO",
        criado_em: { lte: limiteAviso },
        logs_disparos_jobs: {
          none: { tipo: "AVISO_EXCLUSAO_PENDENTE" },
        },
      },
    });

    for (const usuario of usuariosParaAvisar) {
      if (usuario.token_ativacao) {
        try {
          await emailService.enviarEmailAvisoExclusao(
            usuario.email,
            usuario.nome,
            usuario.token_ativacao,
          );

          await prisma.logDisparosJobs.create({
            data: {
              id_usuario: usuario.id_usuario,
              tipo: "AVISO_EXCLUSAO_PENDENTE",
            },
          });
          console.log(`Aviso de exclusão enviado para: ${usuario.email}`);
        } catch (error) {
          console.error(`Erro ao avisar usuário ${usuario.email}:`, error);
        }
      }
    }

    const usuariosParaDeletar = await prisma.usuario.findMany({
      where: {
        status: "PENDENTE",
        tipo_usuario: "CANDIDATO",
        criado_em: { lte: limiteExclusao },
      },
    });

    for (const usuario of usuariosParaDeletar) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.candidato.deleteMany({
            where: { id_usuario: usuario.id_usuario },
          });

          await tx.logDisparosJobs.deleteMany({
            where: { id_usuario: usuario.id_usuario },
          });

          await tx.usuario.delete({
            where: { id_usuario: usuario.id_usuario },
          });
        });

        console.log(`Conta inativa excluída: ${usuario.email}`);
      } catch (error) {
        console.error(
          `Erro ao excluir conta pendente ${usuario.email}:`,
          error,
        );
      }
    }

    console.log("Rotina de higiene finalizada.");
  });
};
