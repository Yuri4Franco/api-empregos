import type { Request, Response } from "express";
import { AdminDashboardService } from "../services/AdminDashboardService";

const adminDashboardService = new AdminDashboardService();

export class AdminDashboardController {
  async resumo(req: Request, res: Response) {
    try {
      const resumo = await adminDashboardService.obterResumo();

      return res.status(200).json({
        success: true,
        data: resumo,
      });
    } catch (error: any) {
      console.error("Erro ao carregar resumo do dashboard:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Erro interno ao carregar os dados do dashboard." 
      });
    }
  }
}

export const adminDashboardController = new AdminDashboardController();