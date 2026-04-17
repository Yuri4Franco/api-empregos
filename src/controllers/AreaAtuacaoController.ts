import type { Request, Response } from "express";
import { AreaAtuacaoService } from "../services/AreaAtuacaoService.js";

const areaService = new AreaAtuacaoService();

export class AreaAtuacaoController {
  async store(req: Request, res: Response) {
    try {
      const id_usuario = (req as any).usuario.id;
      const { id_area } = req.body;
      
      const novaArea = await areaService.adicionar(id_usuario, id_area);
      
      return res.status(201).json({ 
        success: true, 
        message: "Área de atuação adicionada!",
        data: novaArea 
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      const { id_area } = req.params;
      const id_usuario = (req as any).usuario.id;
      
      await areaService.deletar(id_usuario, Number(id_area));
      
      return res.json({ success: true, message: "Área de atuação removida." });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}