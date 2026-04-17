import type { Request, Response } from "express";
import { CompetenciaService } from "../services/CompetenciaService.js";

const competenciaService = new CompetenciaService();

export class CompetenciaController {
  async store(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const novaCompetencia = await competenciaService.adicionar(
        id_usuario,
        req.body,
      );

      return res.status(201).json({
        success: true,
        message: "Competência adicionada!",
        data: novaCompetencia,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      const { id_competencia } = req.params;
      const id_usuario = (req.user as any).id;

      await competenciaService.deletar(id_usuario, Number(id_competencia));

      return res.json({ success: true, message: "Competência removida." });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
