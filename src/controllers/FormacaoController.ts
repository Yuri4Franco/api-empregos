import type { Request, Response } from "express";
import { FormacaoService } from "../services/FormacaoService.js";

const formacaoService = new FormacaoService();

export class FormacaoController {
  async store(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const novaFormacao = await formacaoService.criar(id_usuario, req.body);
      return res.status(201).json({ success: true, data: novaFormacao });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const id_usuario = (req.user as any).id;
      const formacaoAtualizada = await formacaoService.atualizar(
        Number(id),
        id_usuario,
        req.body,
      );
      return res.json({ success: true, data: formacaoAtualizada });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const id_usuario = (req.user as any).id;
      await formacaoService.deletar(Number(id), id_usuario);
      return res.json({ success: true, message: "Formação removida." });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
