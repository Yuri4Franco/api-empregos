import type { Request, Response } from "express";
import { VagaSitemapService } from "../services/VagaSitemapService.js";

export class VagaSitemapController {
  async handle(req: Request, res: Response) {
    try {
      const vagaSitemapService = new VagaSitemapService();
      const vagas = await vagaSitemapService.execute();

      return res.status(200).json(vagas);
    } catch (error: any) {
      return res.status(500).json({ error: "Erro ao gerar dados do sitemap." });
    }
  }
}