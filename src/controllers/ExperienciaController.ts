import type { Request, Response } from "express";
import { ExperienciaService } from "../services/ExperienciaService.js";

const experienciaService = new ExperienciaService();

export class ExperienciaController {
  async store(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const novaExp = await experienciaService.criar(id_usuario, req.body);
      return res.status(201).json({ success: true, data: novaExp });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const id_usuario = (req.user as any).id;
      const expAtualizada = await experienciaService.atualizar(
        Number(id),
        id_usuario,
        req.body,
      );
      return res.json({ success: true, data: expAtualizada });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const id_usuario = (req.user as any).id;
      const experienciaDeletada = await experienciaService.deletar(Number(id), id_usuario);
      return res.json({ success: true, message: "Experiência removida.", data: experienciaDeletada });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
