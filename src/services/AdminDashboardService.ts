import { prisma } from "../config/prisma.js";

export class AdminDashboardService {
  async obterResumo() {
    const [
      totalCandidatos,
      totalCandidatosAtivos,
      totalEmpresasAtivas,
      vagasAtivas,
      empresasAguardando,
      vagasEmAnalise,
      competenciasSugeridas,
      pagamentosAguardando,
    ] = await Promise.all([
      prisma.candidato.count(),
      // Filtra candidatos cujo status do usuário vinculado está como ATIVO
      prisma.candidato.count({ where: { usuario: { status: "ATIVO" } } }),
      prisma.empresa.count({ where: { status: "ATIVO" } }),
      prisma.vaga.count({ where: { status: "ATIVA" } }),
      prisma.empresa.count({ where: { status: "PENDENTE" } }),
      prisma.vaga.count({ where: { status: "EM_ANALISE" } }),
      prisma.competencia.count({ where: { status: "PENDENTE" } }),
      prisma.vaga.count({ where: { status: "AGUARDANDO_PAGAMENTO" } }),
    ]);

    return {
      totais: {
        candidatos: totalCandidatos,
        candidatosAtivos: totalCandidatosAtivos, // Adicionado ao retorno
        empresas: totalEmpresasAtivas,
        vagasAtivas: vagasAtivas,
      },
      pendencias: {
        empresasAguardando: empresasAguardando,
        vagasEmAnalise: vagasEmAnalise,
        competenciasSugeridas: competenciasSugeridas,
        pagamentosAguardando: pagamentosAguardando,
      },
    };
  }
}
