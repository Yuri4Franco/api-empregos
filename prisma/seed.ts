import "dotenv/config";
import { prisma } from "../src/config/prisma";
import argon2 from "argon2";

async function main() {
  console.log("🌱 Iniciando seeding...");

  const emailAdmin = process.env.ADMIN_EMAIL;
  const senhaAdmin = process.env.ADMIN_PASSWORD;

  if (!emailAdmin || !senhaAdmin) {
    throw new Error(
      "🛑 ERRO FATAL: As variáveis ADMIN_EMAIL e ADMIN_PASSWORD não foram definidas no arquivo .env.",
    );
  }

  const adminExistente = await prisma.usuario.findUnique({
    where: { email: emailAdmin },
  });

  if (!adminExistente) {
    // 3. Usa a senha que veio do .env
    const senhaHash = await argon2.hash(senhaAdmin);

    await prisma.usuario.create({
      data: {
        nome: "Administrador Master",
        email: emailAdmin,
        senha_hash: senhaHash,
        tipo_usuario: "ADM",
        status: "ATIVO",
        is_master: true,
        exigir_troca_senha: true,
      },
    });
    console.log("✅ Administrador padrão criado com sucesso!");
  } else {
    console.log("⚠️ Administrador master já existe no sistema.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Erro no seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
