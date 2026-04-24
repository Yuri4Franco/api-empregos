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
        data: novaArea,
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

  async sync(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const { areas_ids } = req.body; // Array validado pelo Zod

      const areasAtualizadas = await areaService.sincronizarAreas(
        id_usuario,
        areas_ids,
      );

      return res.status(200).json({
        success: true,
        message: "Áreas de atuação salvas com sucesso!",
        data: areasAtualizadas,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
