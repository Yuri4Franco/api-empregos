import "dotenv/config";
import { EmailService } from "../services/EmailService.js";

async function testarRevolucaoFila() {
  console.log("🚀 Iniciando teste de disparo na fila do BullMQ...");

  const emailService = new EmailService();

  try {
    // ⚠️ Coloque o seu e-mail pessoal real aqui para ver a mensagem chegando na caixa de entrada!
    const emailDestino = "interyurinho@gmail.com";

    // O console.time vai medir exatamente quantos milissegundos a sua API leva
    // para responder para o usuário agora que usamos o Redis.
    console.time("⚡ Tempo de bloqueio da requisição");

    await emailService.enviarEmailAtivacao(
      emailDestino,
      "Yuri",
      "token-de-teste-123456",
    );

    console.timeEnd("⚡ Tempo de bloqueio da requisição");

    console.log("✅ E-mail enfileirado com sucesso no Redis!");
    console.log(
      "👉 Olhe o terminal onde o seu Worker está rodando para ver o envio acontecendo.",
    );

    // Força o encerramento deste script de teste (já que a conexão do Redis fica aberta por padrão)
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao enfileirar:", error);
    process.exit(1);
  }
}

testarRevolucaoFila();
