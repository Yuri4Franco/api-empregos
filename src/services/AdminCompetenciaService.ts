import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";

export class AdminCompetenciaService {
  // =========================================================
  // 1. LISTAR PENDENTES
  // =========================================================
  async listarPendentes() {
    const competencias = await prisma.competencia.findMany({
      where: { status: "PENDENTE" },
      orderBy: { id_competencia: "desc" },
      include: {
        // Traz a contagem de quantos candidatos já estão surfando nessa skill
        _count: {
          select: { candidatos: true },
        },
        // Buscamos os candidatos vinculados para rastrear se veio de um candidato
        candidatos: {
          take: 1, // Só precisamos do primeiro (quem criou/sugeriu)
          select: {
            candidato: {
              select: {
                usuario: {
                  select: {
                    id_usuario: true,
                    nome: true,
                  },
                },
              },
            },
          },
        },
        // Buscamos também as vagas vinculadas, caso tenha sido sugerida por uma empresa
        vagas: {
          take: 1, // Só precisamos do primeiro
          select: {
            vaga: {
              select: {
                titulo: true,
                empresa: {
                  select: {
                    id_empresa: true,
                    nome_fantasia: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Mapeamos os dados para entregar um JSON limpo e mastigado para o painel administrativo
    return competencias.map((comp) => {
      const primeiroCandidato = comp.candidatos[0]?.candidato?.usuario;
      const primeiraVaga = comp.vagas[0]?.vaga;

      let sugeridoPor = null;

      if (primeiroCandidato) {
        sugeridoPor = {
          id: primeiroCandidato.id_usuario,
          nome: primeiroCandidato.nome,
          origem: "CANDIDATO",
        };
      } else if (primeiraVaga) {
        sugeridoPor = {
          id: primeiraVaga.empresa.id_empresa,
          nome: primeiraVaga.empresa.nome_fantasia,
          origem: "EMPRESA",
          detalhe: `Sugerido na vaga: ${primeiraVaga.titulo}`,
        };
      }

      return {
        id_competencia: comp.id_competencia,
        nome: comp.nome,
        status: comp.status,
        total_usuarios: comp._count.candidatos,
        sugerido_por: sugeridoPor,
      };
    });
  }

  // =========================================================
  // 2. APROVAR DIRETAMENTE
  // =========================================================
  async aprovar(id_competencia: number) {
    const competencia = await prisma.competencia.findUnique({
      where: { id_competencia },
    });

    if (!competencia) throw new Error("Habilidade não encontrada.");
    if (competencia.status !== "PENDENTE")
      throw new Error("Esta habilidade não está pendente.");

    return await prisma.competencia.update({
      where: { id_competencia },
      data: { status: "APROVADA" },
    });
  }

  // =========================================================
  // 3. REJEITAR E LIMPAR DO CURRÍCULO
  // =========================================================
  async rejeitar(id_competencia: number) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Deleta os vínculos do currículo de quem sugeriu (ela "some" do currículo)
      await tx.candidatoCompetencia.deleteMany({
        where: { id_competencia },
      });

      // 2. Muda o status para REJEITADA para que ninguém consiga sugerir a mesma palavra de novo
      const competenciaRejeitada = await tx.competencia.update({
        where: { id_competencia },
        data: { status: "REJEITADA" },
      });

      return competenciaRejeitada;
    });
  }

  // =========================================================
  // 4. A FUNCIONALIDADE SMART: EDITAR E APROVAR
  // =========================================================
  async editarEAprovar(id_competencia: number, novo_nome: string) {
    // Sanitiza o nome exatamente como fizemos no fluxo do candidato
    const nomeSanitizado = novo_nome
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const competenciaPendente = await tx.competencia.findUnique({
        where: { id_competencia },
        include: { candidatos: true },
      });

      if (!competenciaPendente)
        throw new Error("Habilidade pendente não encontrada.");

      // Procura se o nome corrigido JÁ EXISTE no banco
      const competenciaExistente = await tx.competencia.findFirst({
        where: {
          nome: { equals: nomeSanitizado, mode: "insensitive" },
        },
      });

      // CENÁRIO A: O nome corrigido já existe (Ex: Consertou "Ecxel" para "Excel", e "Excel" já existia)
      if (
        competenciaExistente &&
        competenciaExistente.id_competencia !== id_competencia
      ) {
        // Vamos fundir (merge) as duas: Mover todos os candidatos da errada para a certa
        for (const vinculo of competenciaPendente.candidatos) {
          // Confere se o candidato já não tinha o "Excel" certo também cadastrado
          const jaTemACerta = await tx.candidatoCompetencia.findUnique({
            where: {
              id_candidato_id_competencia: {
                id_candidato: vinculo.id_candidato,
                id_competencia: competenciaExistente.id_competencia,
              },
            },
          });

          if (!jaTemACerta) {
            // Move o candidato para a competência correta
            await tx.candidatoCompetencia.create({
              data: {
                id_candidato: vinculo.id_candidato,
                id_competencia: competenciaExistente.id_competencia,
                nivel: vinculo.nivel,
              },
            });
          }
        }

        // Agora que movemos/fundimos todos, excluímos a competência com o erro de digitação
        await tx.candidatoCompetencia.deleteMany({ where: { id_competencia } });
        await tx.competencia.delete({ where: { id_competencia } });

        // Retorna a competência oficial existente
        return competenciaExistente;
      } else {
        return await tx.competencia.update({
          where: { id_competencia },
          data: {
            nome: nomeSanitizado,
            status: "APROVADA", // Já aprova automaticamente
          },
        });
      }
    });
  }
}
