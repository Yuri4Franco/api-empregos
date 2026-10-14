import type { Request, Response } from "express";
import { estatisticasService } from "../services/EstatisticasService.js";

class EstatisticasController {
  async obterMetricasHome(req: Request, res: Response) {
    try {
      const metricas = await estatisticasService.obterMetricasGerais();

      return res.status(200).json({
        success: true,
        data: metricas,
      });
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas gerais:", error);
      return res.status(500).json({
        success: false,
        error: "Não foi possível carregar as métricas da plataforma.",
      });
    }
  }
}

export const estatisticasController = new EstatisticasController();
