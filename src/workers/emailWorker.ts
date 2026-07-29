import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { EmailService } from "../services/EmailService.js";

const emailService = new EmailService();

// Mesma conexão que usamos na fila
const conexaoRedis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

export const workerEmails = new Worker(
  "envio-emails", // 🚨 Tem que ser EXATAMENTE o mesmo nome dado no emailQueue.ts
  async (job: Job) => {
    console.log(
      `⏳ [BullMQ] Iniciando envio do job '${job.name}' para ${job.data.email}...`,
    );

    // 🚀 Aqui a mágica acontece: o worker chama a função interna que tem o Nodemailer!
    await emailService.dispararEmailReal(job.name, job.data);

    return { enviado: true, timestamp: new Date() };
  },
  {
    connection: conexaoRedis,
    concurrency: 2, // Quantos e-mails ele pode tentar disparar ao mesmo tempo
    limiter: {
      max: 50, // 🚨 O seu limite de 50 e-mails...
      duration: 1000 * 60 * 60, // 🚨 ...a cada 1 hora.
    },
  },
);

// Eventos de log para você monitorar no terminal
workerEmails.on("completed", (job) => {
  console.log(
    `✅ [BullMQ] Job '${job.name}' (ID: ${job.id}) concluído com sucesso!`,
  );
});

workerEmails.on("failed", (job, err) => {
  console.error(
    `❌ [BullMQ] Falha no job '${job?.name}' (ID: ${job?.id}):`,
    err.message,
  );
});
