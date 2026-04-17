import { prisma } from "../config/prisma.js";

export class CompetenciaService {
  async adicionar(id_usuario: number, dados: any) {
    // 1. REGRA DE NEGÓCIO: Checar o limite de 10 competências
    const totalCompetencias = await prisma.candidatoCompetencia.count({
      where: { id_candidato: id_usuario },
    });

    if (totalCompetencias >= 10) {
      throw new Error(
        "Você atingiu o limite máximo de 10 competências no seu currículo.",
      );
    }

    // 2. Verificar se o candidato já tem essa competência (para não duplicar)
    const competenciaExistente = await prisma.candidatoCompetencia.findUnique({
      where: {
        id_candidato_id_competencia: {
          id_candidato: id_usuario,
          id_competencia: dados.id_competencia,
        },
      },
    });

    if (competenciaExistente) {
      throw new Error("Você já adicionou esta competência ao seu currículo.");
    }

    // 3. Adiciona a competência
    return await prisma.candidatoCompetencia.create({
      data: {
        id_candidato: id_usuario,
        id_competencia: dados.id_competencia,
        nivel: dados.nivel,
      },
      include: {
        competencia: true,
      },
    });
  }

  async deletar(id_usuario: number, id_competencia: number) {
    // Tenta deletar usando a chave composta (ID do Candidato + ID da Competência)
    try {
      return await prisma.candidatoCompetencia.delete({
        where: {
          id_candidato_id_competencia: {
            id_candidato: id_usuario,
            id_competencia: id_competencia,
          },
        },
      });
    } catch (error) {
      throw new Error("Competência não encontrada no seu currículo.");
    }
  }
}
