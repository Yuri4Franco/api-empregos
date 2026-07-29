import { prisma } from "./config/prisma.js";


async function main() {
  console.log("Iniciando atualização da base de candidatos ativos...");

  // O updateMany agora filtra apenas os registros com status ATIVO
  const resultado = await prisma.usuario.updateMany({
    where: {
      status: "ATIVO", // Filtra para atualizar apenas usuários ativos
    },
    data: {
      email_confirmado: true, // Atualizado para refletir o nome exato da sua coluna
    },
  });

  console.log(
    `Sucesso! ${resultado.count} usuarios ativos foram atualizados para email_confirmado = true.`,
  );
}

main()
  .catch((e) => {
    console.error("Erro ao atualizar a base:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
