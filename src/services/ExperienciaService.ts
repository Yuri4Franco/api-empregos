import { prisma } from "../config/prisma.js";

export class ExperienciaService {
  async criar(id_usuario: number, dados: any) {
    return await prisma.experienciaProfissional.create({
      data: {
        ...dados,
        id_candidato: id_usuario,
      },
    });
  }

  async atualizar(id_experiencia: number, id_usuario: number, dados: any) {
    // Verificamos se a experiência pertence ao usuário antes de atualizar
    const experiencia = await prisma.experienciaProfissional.findFirst({
      where: { id_experiencia, id_candidato: id_usuario },
    });

    if (!experiencia)
      throw new Error("Experiência não encontrada ou permissão negada.");

    return await prisma.experienciaProfissional.update({
      where: { id_experiencia },
      data: dados,
    });
  }

  async deletar(id_experiencia: number, id_usuario: number) {
    const experiencia = await prisma.experienciaProfissional.findFirst({
      where: { id_experiencia, id_candidato: id_usuario },
    });

    if (!experiencia)
      throw new Error("Experiência não encontrada ou permissão negada.");

    return await prisma.experienciaProfissional.delete({
      where: { id_experiencia },
    });
  }
}
