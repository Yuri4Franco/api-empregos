import type { Request, Response } from "express";

import { MetricaService } from "../services/MetricaService.js";

const metricaService = new MetricaService();


export class MetricaController {
  
  async relatorioVagasAtivas(req: Request, res: Response) {
    try {
      const relatorio = await metricaService.vagasAtivas();

      return res.status(200).json({
        success: true,
        total_ativas: relatorio.length,
        data: relatorio,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: "Erro ao gerar relatório de vagas ativas.",
      });
    }
  }
}
