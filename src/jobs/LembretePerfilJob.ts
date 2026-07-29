import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { EmailService } from "../services/EmailService.js";

const emailService = new EmailService();

export const agendarLembretePerfilIncompleto = () => {

  cron.schedule("0 7 */10 * *", async () => {
    console.log("Iniciando verificação de perfis incompletos ou ocultos...");

    const hoje = new Date();
    const quinzeDiasAtras = new Date(hoje);
    quinzeDiasAtras.setDate(hoje.getDate() - 15);

    const candidatosPendentes = await prisma.candidato.findMany({
      where: {
        usuario: {
          status: "ATIVO",
          logs_disparos_jobs: {
            none: {
              tipo: "LEMBRETE_PERFIL_INCOMPLETO",
              data_envio: { gte: quinzeDiasAtras },
            },
          },
        },
        // Se o candidato cair em QUALQUER UMA das condições abaixo, ele será notificado
        OR: [
          { cpf: null }, // Sem CPF
          { areas_atuacao: { none: {} } }, // Nenhuma área de atuação
          { formacoes: { none: {} } }, // Sem histórico escolar/acadêmico
          { competencias: { none: {} } }, // Sem nenhuma habilidade

          // ✨ A Regra Especial da Experiência
          {
            AND: [
              { experiencias: { none: {} } }, // Tem 0 experiências cadastradas
              { primeiro_emprego: { not: true } }, // E NÃO marcou que é o primeiro emprego
            ],
          },
        ],
      },
      include: { usuario: true },
    });

    for (const candidato of candidatosPendentes) {
      try {
        await emailService.enviarEmailLembretePerfil(
          candidato.usuario.email,
          candidato.usuario.nome,
        );

        await prisma.logDisparosJobs.create({
          data: {
            id_usuario: candidato.id_usuario,
            tipo: "LEMBRETE_PERFIL_INCOMPLETO",
          },
        });

        console.log(
          `Lembrete de perfil enviado para: ${candidato.usuario.email}`,
        );
      } catch (error) {
        console.error(
          `Erro ao enviar lembrete para ${candidato.usuario.email}:`,
          error,
        );
      }
    }

    console.log("Verificação de perfis finalizada.");
  });
};
