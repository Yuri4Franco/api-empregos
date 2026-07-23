import { prisma } from "../config/prisma.js";

export class VagaSitemapService {
  async execute() {
    const vagas = await prisma.vaga.findMany({
      where: { status: "ATIVA" },
      select: {
        id_vaga: true,
        data_atualizacao: true,
        criada_em: true,
      },
    });

    return vagas;
  }
}
