import type { Request, Response } from "express";
import { DashboardCandidatoService } from "../services/DashboardCandidatoService.js";

const dashboardService = new DashboardCandidatoService();

export class DashboardCandidatoController {
  async metricas(req: Request, res: Response) {
    try {
      
      const id_usuario = (req.user as any).id;

      if (!id_usuario) {
        return res.status(401).json({ success: false, error: "Usuário não autenticado." });
      }

      const dados = await dashboardService.obterMetricas(id_usuario);

      return res.status(200).json({
        success: true,
        data: dados
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async candidaturasRecentes(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const dados = await dashboardService.listarCandidaturasRecentes(id_usuario);

      return res.status(200).json({
        success: true,
        data: dados
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async vagasRecomendadas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const dados = await dashboardService.listarVagasRecomendadas(id_usuario);

      return res.status(200).json({
        success: true,
        data: dados
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}