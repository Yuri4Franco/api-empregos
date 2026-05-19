import { prisma } from "../config/prisma.js";

export class AdminDashboardService {
async obterResumo() {
    // 🚀 Adicionamos a contagem de pagamentos aguardando
    const [
      totalCandidatos,
      totalEmpresasAtivas,
      vagasAtivas,
      empresasAguardando,
      vagasEmAnalise,
      competenciasSugeridas,
      pagamentosAguardando, // Nova variável
    ] = await Promise.all([
      prisma.candidato.count(),
      prisma.empresa.count({ where: { status: "ATIVO" } }),
      prisma.vaga.count({ where: { status: "ATIVA" } }),
      prisma.empresa.count({ where: { status: "PENDENTE" } }),
      prisma.vaga.count({ where: { status: "EM_ANALISE" } }),
      prisma.competencia.count({ where: { status: "PENDENTE" } }),
      prisma.vaga.count({ where: { status: "AGUARDANDO_PAGAMENTO" } }), // Nova consulta
    ]);

    return {
      totais: {
        candidatos: totalCandidatos,
        empresas: totalEmpresasAtivas,
        vagasAtivas: vagasAtivas,
      },
      pendencias: {
        empresasAguardando: empresasAguardando,
        vagasEmAnalise: vagasEmAnalise,
        competenciasSugeridas: competenciasSugeridas,
        pagamentosAguardando: pagamentosAguardando, // Novo campo no JSON
      },
    };
  }
}