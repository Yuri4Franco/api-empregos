import cron from "node-cron";
import { prisma } from "../config/prisma";
import { EmailService } from "../services/EmailService";

const emailService = new EmailService();

export const agendarInativacaoPorInatividade = () => {
  cron.schedule("0 4 * * *", async () => {
    console.log("Iniciando rotina de verificação de inatividade de login...");

    const hoje = new Date();

    const limiteOcultar = new Date(hoje);
    limiteOcultar.setDate(hoje.getDate() - 180);

    const limiteAviso = new Date(hoje);
    limiteAviso.setDate(hoje.getDate() - 160);

    const candidatosParaAvisar = await prisma.candidato.findMany({
      where: {
        perfil_visivel_empresas: true,
        usuario: {
          status: "ATIVO",
          ultimo_login: {
            lte: limiteAviso,
            gte: limiteOcultar,
          },
          OR: [
            { data_aviso_inativo: null },
            { data_aviso_inativo: { lt: limiteOcultar } },
          ],
        },
      },
      include: { usuario: true },
    });

    for (const cand of candidatosParaAvisar) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.usuario.update({
            where: { id_usuario: cand.id_usuario },
            data: { data_aviso_inativo: hoje },
          });
          await tx.logDisparosJobs.create({
            data: {
              id_usuario: cand.id_usuario,
              tipo: "AVISO_PERFIL_OCULTO_INATIVIDADE",
            },
          });
        });

        await emailService.enviarEmailAvisoOcultacao(
          cand.usuario.email,
          cand.usuario.nome,
        );
        console.log(
          `Aviso de ocultação registrado e enviado para: ${cand.usuario.email}`,
        );
      } catch (error) {
        console.error(`Erro ao avisar candidato ${cand.usuario.email}:`, error);
      }
    }

    const candidatosParaOcultar = await prisma.candidato.findMany({
      where: {
        perfil_visivel_empresas: true,
        usuario: {
          status: "ATIVO",
          ultimo_login: { lte: limiteOcultar },
        },
      },
      include: { usuario: true },
    });

    for (const cand of candidatosParaOcultar) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.candidato.update({
            where: { id_usuario: cand.id_usuario },
            data: { perfil_visivel_empresas: false },
          });
          await tx.usuario.update({
            where: { id_usuario: cand.id_usuario },
            data: {
              motivo_inativacao: "PERFIL_OCULTADO_POR_INATIVIDADE_180_DIAS",
            },
          });

          await tx.logDisparosJobs.create({
            data: {
              id_usuario: cand.id_usuario,
              tipo: "PERFIL_OCULTADO_POR_INATIVIDADE",
            },
          });
        });
        
        await emailService.enviarEmailPerfilOcultado(
          cand.usuario.email,
          cand.usuario.nome,
        );
        console.log(
          `Perfil ocultado por inatividade e motivo registrado: ${cand.usuario.email}`,
        );
      } catch (error) {
        console.error(
          `Erro ao ocultar perfil do usuário ${cand.usuario.email}:`,
          error,
        );
      }
    }

    console.log("Rotina de inatividade finalizada.");
  });
};
