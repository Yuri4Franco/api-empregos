import { prisma } from "../config/prisma.js";

export class FormacaoService {
  async criar(id_usuario: number, dados: any) {
    return await prisma.formacaoAcademica.create({
      data: {
        ...dados,
        id_candidato: id_usuario,
      },
    });
  }

  async atualizar(id_formacao: number, id_usuario: number, dados: any) {
    // Trava: garante que a formação é dele
    const formacao = await prisma.formacaoAcademica.findFirst({
      where: { id_formacao, id_candidato: id_usuario },
    });

    if (!formacao)
      throw new Error("Formação não encontrada ou permissão negada.");

    return await prisma.formacaoAcademica.update({
      where: { id_formacao },
      data: dados,
    });
  }

  async deletar(id_formacao: number, id_usuario: number) {
    // Trava: garante que a formação é dele
    const formacao = await prisma.formacaoAcademica.findFirst({
      where: { id_formacao, id_candidato: id_usuario },
    });

    if (!formacao)
      throw new Error("Formação não encontrada ou permissão negada.");

    return await prisma.formacaoAcademica.delete({
      where: { id_formacao },
    });
  }
}
