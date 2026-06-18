import { prisma } from "../config/prisma.js";

export class MetricaService {
  async vagasAtivas() {
    const hoje = new Date();
    const vagasAtivas = await prisma.vaga.findMany({
      where: {
        status: "ATIVA",
        OR: [
          { data_encerramento: { gte: hoje } },
          { data_encerramento: null },
        ],
      },
      select: {
        id_vaga: true,
        titulo: true,
        data_encerramento: true,
        empresa: {
          select: {
            nome_fantasia: true,
            razao_social: true,
          },
        },
      },
      orderBy: {
        data_encerramento: "asc",
      },
    });

    return vagasAtivas.map((vaga) => ({
      id_vaga: vaga.id_vaga,
      titulo: vaga.titulo,
      empresa: vaga.empresa.nome_fantasia || vaga.empresa.razao_social,
      data_encerramento: vaga.data_encerramento,
    }));
  }
}
