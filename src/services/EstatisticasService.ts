import { prisma } from "../config/prisma.js";

class EstatisticasService {
  async obterMetricasGerais() {
    // 🚀 Promise.all roda as 4 queries no banco ao mesmo tempo, reduzindo o tempo de resposta drasticamente
    const [
      totalCurriculosAtivos,
      totalEmpresas,
      totalVagasDivulgadas,
      totalCandidaturas,
      totalCandidatos,
    ] = await Promise.all([
      // 1. Currículos ativos (Visíveis no banco e com conta ATIVA)
      prisma.candidato.count({
        where: {
          perfil_visivel_empresas: true,
          usuario: { status: "ATIVO" },
        },
      }),

      // 2. Empresas cadastradas (Apenas empresas ativas na plataforma)
      prisma.empresa.count({
        where: { status: "ATIVO" },
      }),

      // 3. Vagas divulgadas (Ignora Rascunho, Reprovada e Aguardando Pagamento)
      prisma.vaga.count({
        where: {
          status: {
            in: ["ATIVA", "PAUSADA", "ENCERRADA"],
          },
        },
      }),

      // 4. Quantidade de candidaturas (Total histórico)
      prisma.candidatura.count(),

      // 5. Total de candidatos ativos
      prisma.candidato.count({
        where: {
          usuario: { status: "ATIVO" },
        },
      }),
    ]);

    return {
      curriculos_ativos: totalCurriculosAtivos,
      empresas_cadastradas: totalEmpresas,
      vagas_divulgadas: totalVagasDivulgadas,
      candidaturas_realizadas: totalCandidaturas,
      candidatos_ativos: totalCandidatos,
    };
  }
}

export const estatisticasService = new EstatisticasService();
