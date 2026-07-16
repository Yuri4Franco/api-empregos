import type { Request, Response } from "express";
import { ConfiguracaoPrecoService } from "../services/ConfiguracaoPrecoService.js";

const precoService = new ConfiguracaoPrecoService();

export class ConfiguracaoPrecoController {

  async obter(req: Request, res: Response) {
    try {
      const precos = await precoService.obterPrecos();
      return res.status(200).json({ success: true, data: precos });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: "Erro interno ao buscar a tabela de preços da plataforma.",
      });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const precos = await precoService.atualizarPrecos(req.body);
      return res.status(200).json({
        success: true,
        message: "Tabela de preços e créditos atualizada com sucesso!",
        data: precos,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
