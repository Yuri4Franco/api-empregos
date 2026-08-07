import { prisma } from "./config/prisma.js";
import { CandidatoService } from "./services/CandidatoService.js";
const candidatoService = new CandidatoService();

async function recalcularTodos() {
  console.log(
    "🔄 Iniciando o recálculo da porcentagem de todos os candidatos...",
  );

  try {
    // 1. Busca todos os IDs dos candidatos cadastrados
    const candidatos = await prisma.candidato.findMany({
      select: { id_usuario: true },
    });

    console.log(
      `📊 Encontrados ${candidatos.length} candidatos para atualizar.`,
    );

    let atualizados = 0;

    // 2. Itera sobre cada candidato atualizando a porcentagem
    for (const cand of candidatos) {
      await candidatoService.atualizarPorcentagemCurriculo(cand.id_usuario);
      atualizados++;

      if (atualizados % 50 === 0) {
        console.log(
          `⚡ Progresso: ${atualizados}/${candidatos.length} processados...`,
        );
      }
    }

    console.log("✅ Recálculo concluído com sucesso para todos os candidatos!");
  } catch (error) {
    console.error("❌ Erro ao recalcular porcentagens:", error);
  } finally {
    await prisma.$disconnect();
  }
}

recalcularTodos();
