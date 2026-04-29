import { prisma } from "../config/prisma.js";

export class EmpresaDashboardService {
  async obterEstatisticas(id_empresa: number) {
    // Usamos Promise.all para rodar as 4 contagens simultaneamente no PostgreSQL!
    const [
      vagasAtivas,
      totalVagas,
      totalCandidaturas,
      candidaturasPendentes
    ] = await Promise.all([
      prisma.vaga.count({
        where: { id_empresa, status: "ATIVA" },
      }),
      prisma.vaga.count({
        where: { id_empresa },
      }),
      prisma.candidatura.count({
        where: { vaga: { id_empresa } }, // O Prisma faz o JOIN com Vaga automaticamente aqui!
      }),
      prisma.candidatura.count({
        where: { 
          vaga: { id_empresa },
          status_atual: "INSCRITO" 
        },
      }),
    ]);

    return {
      vagas_ativas: vagasAtivas,
      total_vagas: totalVagas,
      total_candidaturas: totalCandidaturas,
      candidaturas_pendentes: candidaturasPendentes,
    };
  }

  async obterResumoVagas(id_empresa: number) {
    // 1. Busca as vagas ativas (limitado a 10 para o dashboard não ficar gigante)
    // e já traz a contagem TOTAL de candidaturas de cada uma
    const vagasAtivas = await prisma.vaga.findMany({
      where: { 
        id_empresa, 
        status: "ATIVA" 
      },
      select: {
        id_vaga: true,
        titulo: true,
        data_encerramento: true,
        _count: {
          select: { candidaturas: true } // Conta todos os inscritos
        }
      },
      orderBy: {
        data_publicacao: "desc" // As mais recentes primeiro
      },
      take: 10 
    });

    // 2. Mapeia cada vaga para buscar os candidatos "Novos" (Status: INSCRITO)
    const resumoComNovos = await Promise.all(
      vagasAtivas.map(async (vaga) => {
        const novosInscritos = await prisma.candidatura.count({
          where: {
            id_vaga: vaga.id_vaga,
            status_atual: "INSCRITO" // O status que define um currículo não lido/triado
          }
        });

        return {
          id_vaga: vaga.id_vaga,
          titulo: vaga.titulo,
          data_encerramento: vaga.data_encerramento,
          total_inscritos: vaga._count.candidaturas,
          novos_inscritos: novosInscritos
        };
      })
    );

    return resumoComNovos;
  }

  async obterProximasEntrevistas(id_empresa: number) {
    const agendamentos = await prisma.agendamentoEntrevista.findMany({
      where: {
        // Pega apenas entrevistas de agora para frente (futuras)
        data_hora: {
          gte: new Date(), 
        },
        candidatura: {
          // Filtra para garantir que a vaga pertence a esta empresa
          vaga: {
            id_empresa: id_empresa,
          },
          // Ignora caso a candidatura tenha sido cancelada ou reprovada antes da entrevista
          status_atual: { notIn: ["REPROVADO", "DESISTENCIA"] }
        },
      },
      orderBy: {
        data_hora: "asc", // A mais próxima aparece primeiro no topo
      },
      take: 5, // Limita a 5 para não quebrar o layout do Card no Dashboard
      select: {
        id_agendamento: true,
        data_hora: true,
        local_link: true,
        candidatura: {
          select: {
            id_candidatura: true,
            vaga: {
              select: { titulo: true }
            },
            candidato: {
              select: {
                usuario: {
                  select: { nome: true }
                }
              }
            }
          }
        }
      }
    });

    // "Achatamos" (Flatten) o objeto para o Front-end receber um JSON limpo e direto
    return agendamentos.map((agendamento) => ({
      id_agendamento: agendamento.id_agendamento,
      id_candidatura: agendamento.candidatura.id_candidatura,
      nome_candidato: agendamento.candidatura.candidato.usuario.nome,
      titulo_vaga: agendamento.candidatura.vaga.titulo,
      data_hora: agendamento.data_hora,
      local_link: agendamento.local_link,
    }));
  }
}