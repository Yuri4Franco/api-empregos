import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { EmailService } from "../services/EmailService.js";

const emailService = new EmailService();

const conexaoRedis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

export const workerEmails = new Worker(
  "envio-emails",
  async (job: Job) => {
    console.log(
      `⏳ [BullMQ] Iniciando envio do job '${job.name}' para ${job.data.email}...`,
    );

    await emailService.dispararEmailReal(job.name, job.data);

    return { enviado: true, timestamp: new Date() };
  },
  {
    connection: conexaoRedis,
    concurrency: 2,
    limiter: {
      max: 50,
      duration: 1000 * 60 * 60,
    },
  },
);

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
