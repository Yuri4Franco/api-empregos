// EmpresaController.ts
import type { Request, Response } from "express";
import { EmpresaService } from "../services/EmpresaService.js";

const empresaService = new EmpresaService();

export class EmpresaController {
  async desbloquearCandidato(req: Request, res: Response) {
    try {
      const { id_candidato } = req.params;
      const user = req.user as any;

      if (user.role !== "EMPRESA") {
        return res.status(403).json({ message: "Apenas empresas podem desbloquear currículos." });
      }

      const perfil = await empresaService.visualizarPerfilCandidato(
        user.id_empresa, 
        Number(id_candidato)
      );

      return res.status(200).json({
        success: true,
        message: "Currículo desbloqueado com sucesso!",
        data: perfil
      });
    } catch (error: any) {
      return res.status(402).json({ // 402 Payment Required é elegante aqui
        success: false, 
        error: error.message 
      });
    }
  }
}