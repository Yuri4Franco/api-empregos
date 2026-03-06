// CandidatoService.ts
import { prisma } from "../config/prisma.js";

export class CandidatoService {
  async listarMinhasCandidaturas(id_candidato: number) {
    return await prisma.candidatura.findMany({
      where: { id_candidato },
      include: {
        vaga: {
          select: {
            id_vaga: true,
            titulo: true,
            cidade: true,
            uf: true,
            status: true,
            empresa_confidencial: true, // CORRETO: O campo pertence à Vaga
            empresa: {
              select: {
                nome_fantasia: true,
                logotipo_url: true,
                // Removido o campo daqui
              },
            },
          },
        },
      },
      orderBy: { data_candidatura: "desc" },
    });
  }
}
