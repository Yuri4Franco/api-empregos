import type { Request, Response } from "express";
import { AdminCompetenciaService } from "../services/AdminCompetenciaService.js";

const adminCompetenciaService = new AdminCompetenciaService();

export class AdminCompetenciaController {
  
  async listarPendentes(req: Request, res: Response) {
    try {
      const lista = await adminCompetenciaService.listarPendentes();
      return res.status(200).json({ success: true, data: lista });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async aprovar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) throw new Error("ID inválido.");

      const result = await adminCompetenciaService.aprovar(id);
      return res.status(200).json({ success: true, message: "Habilidade aprovada e publicada!", data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async rejeitar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) throw new Error("ID inválido.");

      await adminCompetenciaService.rejeitar(id);
      return res.status(200).json({ success: true, message: "Habilidade rejeitada e removida dos currículos." });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async editarEAprovar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { novo_nome } = req.body;

      if (!id) throw new Error("ID inválido.");
      if (!novo_nome) throw new Error("O novo nome é obrigatório.");

      const result = await adminCompetenciaService.editarEAprovar(id, novo_nome);
      return res.status(200).json({ 
        success: true, 
        message: "Habilidade editada e currículos atualizados!", 
        data: result 
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}

export const adminCompetenciaController = new AdminCompetenciaController();