import "dotenv/config";
import { prisma } from "../src/config/prisma";
import argon2 from "argon2";

async function main() {
  console.log("🌱 Iniciando seeding...");

  const emailAdmin = "admin@acivagas.com.br";

  const adminExistente = await prisma.usuario.findUnique({
    where: { email: emailAdmin },
  });

  if (!adminExistente) {
    const senhaHash = await argon2.hash("@ICA#19364$#acivagas");

    await prisma.usuario.create({
      data: {
        nome: "Administrador Master",
        email: emailAdmin,
        senha_hash: senhaHash,
        tipo_usuario: "ADM",
        status: "ATIVO",
      },
    });
    console.log("✅ Administrador padrão criado com sucesso!");
  } else {
    console.log("⚠️ Administrador já existe no sistema.");
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
