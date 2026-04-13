import type { Request, Response } from "express";
import { BaseUserService } from "../services/BaseUserService";

const userService = new BaseUserService();

export class UserController {
  async toggleStatus(req: Request, res: Response) {
    try {
      const id_usuario = parseInt(req.params.id as string);
      const { status } = req.body;
      const id_autor = req.user.id;

      const usuario = await userService.alterarStatus(
        id_usuario,
        status,
        id_autor,
      );
      return res.json({ message: `Status alterado para ${status}`, usuario });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async trocarSenha(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      const { nova_senha } = req.body;
      const id_autor = req.user.id;

      const usuario = await userService.TrocarSenha(id, nova_senha, id_autor);
      return res.json({ message: "Senha alterada com sucesso", usuario });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async obterPerfil(req: Request, res: Response) {
    try {
      const id_usuario = req.user.id;

      const perfil = await userService.obterPerfil(id_usuario);

      return res.status(200).json(perfil);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }
}
