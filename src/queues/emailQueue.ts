import { Queue } from "bullmq";
import { Redis } from "ioredis"; // 👈 Correção 1: Importação nomeada com chaves

// Conexão com o Redis local
const conexaoRedis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // Obrigatório para o BullMQ
});

export interface DadosEmailJob {
  para: string;
  assunto: string;
  corpoHtml: string;
}

// 👈 Correção 2 e 3: Genéricos completos <Dados, Retorno, Nome> e sem 'limiter' aqui
export const filaEmails = new Queue<any, any, string>("envio-emails", {
  connection: conexaoRedis,
  defaultJobOptions: {
    attempts: 3, // Tenta 3 vezes se o servidor SMTP falhar
    backoff: {
      type: "exponential",
      delay: 5000, // Espera 5s, 25s, 125s entre tentativas
    },
    removeOnComplete: true, // Limpa o Redis automaticamente após o envio
    removeOnFail: false, // Mantém no Redis em caso de falha definitiva para auditoria
  },
});

export async function enfileirarEmail(dados: DadosEmailJob) {
  // Agora o TypeScript aceita "enviar-email" sem reclamar!
  return await filaEmails.add("enviar-email", dados);
}
