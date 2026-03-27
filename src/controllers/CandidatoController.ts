// CandidatoController.ts
import type { Request, Response } from "express";
import { CandidatoService } from "../services/CandidatoService.js";

const candidatoService = new CandidatoService();

export class CandidatoController {
  async minhasVagas(req: Request, res: Response) {
    try {
      const user = req.user as any;

      const candidaturas = await candidatoService.listarMinhasCandidaturas(
        user.id,
      );

      const candidaturasTratadas = candidaturas.map((c: any) => ({
        id_candidatura: c.id_candidatura,
        data_inscricao: c.data_candidatura,
        status_processo: c.status_atual,
        vaga: {
          titulo: c.vaga.titulo,
          // ACESSO CORRIGIDO: Agora pegamos do objeto endereco
          local: c.vaga.endereco
            ? `${c.vaga.endereco.cidade}/${c.vaga.endereco.uf}`
            : "Remoto/Não informado",
          empresa: c.vaga.empresa_confidencial
            ? "Empresa Confidencial"
            : c.vaga.empresa.nome_fantasia,
          logo: c.vaga.empresa_confidencial
            ? null
            : c.vaga.empresa.logotipo_url,
          vaga_ativa: c.vaga.status === "ATIVA",
        },
      }));

      return res.status(200).json({
        success: true,
        data: candidaturasTratadas,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
