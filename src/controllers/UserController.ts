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

  async alterarSenha(req: Request, res: Response) {
    try {
      const id_usuario = req.user.id;
      const { senha_atual, nova_senha } = req.body;
      if (!senha_atual || !nova_senha) {
        return res.status(400).json({
          success: false,
          error: "Preencha todos os campos obrigatórios.",
        });
      }

      const resultado = await userService.alterarSenha(
        id_usuario,
        senha_atual,
        nova_senha,
      );

      return res.json({ success: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async definirSenhaInicial(req: Request, res: Response) {
    try {
      const id_usuario = req.user.id;
      const { nova_senha } = req.body;

      if (!nova_senha) {
        return res
          .status(400)
          .json({ success: false, error: "A nova senha é obrigatória." });
      }

      const resultado = await userService.definirSenhaInicial(
        id_usuario,
        nova_senha,
      );
      return res.json({ success: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
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

  async deletarConta(req: Request, res: Response) {
    try {
      
      const id_usuario = req.user.id;
      const { senha_confirmacao } = req.body;

      if (!id_usuario) {
        return res.status(401).json({
          success: false,
          error: "Usuário não autenticado.",
        });
      }

      const resultado = await userService.excluirConta(
        id_usuario,
        senha_confirmacao,
      );

      return res.status(200).json({
        success: true,
        message: resultado.message,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}
