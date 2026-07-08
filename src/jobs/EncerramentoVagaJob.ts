import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";

export function agendarEncerramentoVagasAutomatico() {
  // Executa todos os dias à meia-noite (00:00)
  cron.schedule("0 0 * * *", async () => {
    console.log("=== [CRON] Iniciando rotinas de ciclo de vida das vagas... ===");
    
    try {
      const hoje = new Date();
      // Constantes de tempo para as regras de negócio
      const limite15Dias = new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000);
      const limite30Dias = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
      const limite45Dias = new Date(hoje.getTime() - 45 * 24 * 60 * 60 * 1000);

      // ======================================================================
      // 1. ROTINA DE FECHAMENTO (MUDANÇA PARA 'PAUSADA' / TRIAGEM)
      // ======================================================================
      const vagasParaPausar = await prisma.vaga.findMany({
        where: {
          status: "ATIVA",
          OR: [
            // Regra 1: Data de fechamento foi preenchida e chegou/passou
            { data_fechamento: { not: null, lte: hoje } },
            // Regra 2: Data nula, então pausa com 15 dias corridos
            { data_fechamento: null, data_publicacao: { lte: limite15Dias } }
          ]
        },
        include: {
          empresa: {
            select: {
              usuarios: {
                where: { status: "ATIVO" }, // ✨ Traz TODOS os usuários ativos da empresa
                select: { id_usuario: true }
              }
            }
          }
        }
      });

      if (vagasParaPausar.length > 0) {
        console.log(`[CRON] Pausando (entrando em triagem) ${vagasParaPausar.length} vaga(s)...`);

        for (const vaga of vagasParaPausar) {
          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.vaga.update({
              where: { id_vaga: vaga.id_vaga },
              data: { status: "PAUSADA" }
            });

            // Notifica todos os usuários da empresa sobre o status de triagem
            const notificacoes = vaga.empresa.usuarios.map((u) => 
              tx.notificacao.create({
                data: {
                  id_usuario: u.id_usuario,
                  titulo: "Candidaturas Pausadas",
                  mensagem: `A vaga "${vaga.titulo}" parou de receber novas candidaturas e entrou em fase de triagem. Você pode reabri-la no painel a qualquer momento.`,
                  tipo: "INFO",
                  link_acao: `/empresa/vagas`
                }
              })
            );

            if (notificacoes.length > 0) await Promise.all(notificacoes);
          });
        }
      }

      // ======================================================================
      // 2. ROTINA DE ENCERRAMENTO DEFINITIVO (REPROVAÇÃO EM MASSA)
      // ======================================================================
      const vagasParaEncerrar = await prisma.vaga.findMany({
        where: {
          status: { in: ["ATIVA", "PAUSADA"] },
          OR: [
            // Regra 1: Data de encerramento foi preenchida e bateu
            { data_encerramento: { not: null, lte: hoje } },
            // Regra 2: Data nula e estendida para 45 dias
            { 
              data_encerramento: null, 
              extender_encerramento: true, 
              data_publicacao: { lte: limite45Dias } 
            },
            // Regra 3: Data nula e normal (30 dias)
            { 
              data_encerramento: null, 
              extender_encerramento: { not: true }, // Cobre false ou null
              data_publicacao: { lte: limite30Dias } 
            }
          ]
        },
        include: {
          empresa: { 
            select: { 
              nome_fantasia: true, 
              razao_social: true,
              usuarios: {
                where: { status: "ATIVO" },
                select: { id_usuario: true }
              }
            } 
          },
          candidaturas: {
            where: {
              status_atual: { notIn: ["APROVADO", "REPROVADO", "DESISTENCIA"] }
            },
            include: {
              candidato: {
                include: {
                  usuario: { select: { id_usuario: true, nome: true } }
                }
              }
            }
          }
        }
      });

      if (vagasParaEncerrar.length > 0) {
        console.log(`[CRON] Encerrando definitivamente ${vagasParaEncerrar.length} vaga(s)...`);

        for (const vaga of vagasParaEncerrar) {
          const nomeEmpresa = vaga.empresa.nome_fantasia || vaga.empresa.razao_social;

          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // A. Atualiza a vaga
            await tx.vaga.update({
              where: { id_vaga: vaga.id_vaga },
              data: { status: "ENCERRADA" }
            });

            const notificacoesParaCriar = [] as any[];

            // B. Avisa todos os usuários da empresa que encerrou
            vaga.empresa.usuarios.forEach((u) => {
              notificacoesParaCriar.push(
                tx.notificacao.create({
                  data: {
                    id_usuario: u.id_usuario,
                    titulo: "Vaga Encerrada Automaticamente",
                    mensagem: `O ciclo de vida da vaga "${vaga.titulo}" chegou ao fim. Os candidatos pendentes receberam um feedback automático de encerramento.`,
                    tipo: "INFO",
                    link_acao: `/empresa/vagas`
                  }
                })
              );
            });

            // C. Lida com candidatos pendentes
            if (vaga.candidaturas.length > 0) {
              const idsCandidaturas = vaga.candidaturas.map((c) => c.id_candidatura);

              await tx.movimentoCandidatura.createMany({
                data: vaga.candidaturas.map((c) => ({
                  id_candidatura: c.id_candidatura,
                  etapa_origem: c.id_etapa_atual,
                  etapa_destino: c.id_etapa_atual,
                  status_destino: "REPROVADO",
                  motivo: "A vaga foi encerrada e a candidatura não avançou para a etapa final.",
                  notificacao_pendente: false
                }))
              });

              await tx.candidatura.updateMany({
                where: { id_candidatura: { in: idsCandidaturas } },
                data: { status_atual: "REPROVADO" }
              });

              // D. Feedback ao candidato
              vaga.candidaturas.forEach((c) => {
                notificacoesParaCriar.push(
                  tx.notificacao.create({
                    data: {
                      id_usuario: c.candidato.usuario.id_usuario,
                      titulo: "Feedback de Candidatura 📄",
                      mensagem: `A vaga "${vaga.titulo}" na empresa ${nomeEmpresa} foi encerrada e sua candidatura não avançou. Agradecemos seu interesse e desejamos sucesso nas próximas oportunidades!`,
                      tipo: "INFO",
                      link_acao: `/candidato/candidaturas/${c.id_candidatura}`
                    }
                  })
                );
              });
            }

            if (notificacoesParaCriar.length > 0) {
              await Promise.all(notificacoesParaCriar);
            }
          });
        }
      } else {
        console.log("[CRON] Nenhuma vaga precisou ser encerrada hoje.");
      }

      console.log("=== [CRON] Rotina de vagas concluída com sucesso. ===");
    } catch (error) {
      console.error("[CRON - ERRO CRÍTICO]: Erro ao rodar rotina de ciclo de vida das vagas:", error);
    }
  });
}