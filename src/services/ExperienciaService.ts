import { prisma } from "../config/prisma.js";
import { CandidatoService } from "./CandidatoService.js";

const candidatoService = new CandidatoService();

export class ExperienciaService {
  async criar(id_usuario: number, dados: any) {
    const novaExperiencia = await prisma.experienciaProfissional.create({
      data: {
        ...dados,
        id_candidato: id_usuario,
      },
    });

    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    return {
      experiencia: novaExperiencia,
      porcentagem_curriculo: novaNota,
    };
  }

  async atualizar(id_experiencia: number, id_usuario: number, dados: any) {
    const experiencia = await prisma.experienciaProfissional.findFirst({
      where: { id_experiencia, id_candidato: id_usuario },
    });

    if (!experiencia)
      throw new Error("Experiência não encontrada ou permissão negada.");

    const experienciaAtualizada = await prisma.experienciaProfissional.update({
      where: { id_experiencia },
      data: dados,
    });

    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    return {
      experiencia: experienciaAtualizada,
      porcentagem_curriculo: novaNota,
    };
  }

  async deletar(id_experiencia: number, id_usuario: number) {
    const experiencia = await prisma.experienciaProfissional.findFirst({
      where: { id_experiencia, id_candidato: id_usuario },
    });

    if (!experiencia)
      throw new Error("Experiência não encontrada ou permissão negada.");

    const experienciaDeletada = await prisma.experienciaProfissional.delete({
      where: { id_experiencia },
    });

    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    return {
      experiencia: experienciaDeletada,
      porcentagem_curriculo: novaNota,
    };
  }
}
