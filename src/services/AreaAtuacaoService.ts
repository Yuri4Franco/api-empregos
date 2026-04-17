import { prisma } from "../config/prisma.js";

export class AreaAtuacaoService {
  async adicionar(id_usuario: number, id_area: number) {
    // 1. REGRA: Máximo de 3 áreas
    const totalAreas = await prisma.candidatoAreaAtuacao.count({
      where: { id_candidato: id_usuario },
    });

    if (totalAreas >= 3) {
      throw new Error("Você atingiu o limite máximo de 3 áreas de atuação.");
    }

    // 2. REGRA: Evitar duplicação
    const areaExistente = await prisma.candidatoAreaAtuacao.findUnique({
      where: {
        id_candidato_id_area: {
          id_candidato: id_usuario,
          id_area: id_area,
        },
      },
    });

    if (areaExistente) {
      throw new Error("Você já adicionou esta área de atuação ao seu perfil.");
    }

    // 3. Adicionar a área
    return await prisma.candidatoAreaAtuacao.create({
      data: {
        id_candidato: id_usuario,
        id_area: id_area,
      },
      include: {
        area: true, // Retorna o nome da área para o front-end
      }
    });
  }

  async deletar(id_usuario: number, id_area: number) {
    try {
      return await prisma.candidatoAreaAtuacao.delete({
        where: {
          id_candidato_id_area: {
            id_candidato: id_usuario,
            id_area: id_area,
          },
        },
      });
    } catch (error) {
      throw new Error("Área de atuação não encontrada no seu perfil.");
    }
  }
}