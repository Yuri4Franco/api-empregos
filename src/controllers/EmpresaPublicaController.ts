import type { Request, Response } from "express";
import { EmpresaPublicaService } from "../services/EmpresaPublicaService.js";

const empresaPublicaService = new EmpresaPublicaService();

export class EmpresaPublicaController {
  async buscarPorSlug(req: Request, res: Response) {
    try {
        const slug = req.params.slug as string;

      if (!slug) {
        return res.status(400).json({ 
          success: false, 
          error: "O link da empresa não foi informado." 
        });
      }

      const perfil = await empresaPublicaService.buscarPerfilPublico(slug);

      return res.status(200).json({
        success: true,
        data: perfil,
      });
    } catch (error: any) {
      // Retorna 404 para o Next.js saber que deve renderizar a página de "Not Found"
      return res.status(404).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}