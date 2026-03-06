import type { Request, Response } from "express";
import { VagaService } from "../services/VagaService.js";

const vagaService = new VagaService();

export class AdminVagaController {
  // GET /admin/vagas/pendentes
  async listarPendentes(req: Request, res: Response) {
    try {
      const vagas = await vagaService.listarVagasPendentes();
      return res.status(200).json({ success: true, data: vagas });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // PATCH /admin/vagas/:id/moderacao
  async moderar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { acao } = req.body; // "APROVAR" ou "REPROVAR"

      if (!["APROVAR", "REPROVAR"].includes(acao)) {
        throw new Error("Ação inválida. Use APROVAR ou REPROVAR.");
      }

      const novoStatus = acao === "APROVAR" ? "ATIVA" : "REPROVADA";
      const vaga = await vagaService.moderarVaga(Number(id), novoStatus);

      return res.status(200).json({
        success: true,
        message: `Vaga ${acao === "APROVAR" ? "aprovada e publicada" : "reprovada"} com sucesso.`,
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
