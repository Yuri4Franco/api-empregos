import type { Request, Response } from 'express';
import { BaseUserService } from '../services/BaseUserService';

const userService = new BaseUserService();

export class UserController {
  async atualizar(req: Request, res: Response) {
    try {
      const id_usuario = parseInt(req.params.id as string);
      const id_autor = req.user.id; // Vem do middleware de auth
      
      const usuario = await userService.atualizarDadosBasicos(id_usuario, req.body, id_autor);
      
      return res.json({ message: "Usuário atualizado com sucesso", usuario });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async toggleStatus(req: Request, res: Response) {
    try {
      const id_usuario = parseInt(req.params.id as string);
      const { status } = req.body;
      const id_autor = req.user.id;

      const usuario = await userService.alterarStatus(id_usuario, status, id_autor);
      return res.json({ message: `Status alterado para ${status}`, usuario });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}