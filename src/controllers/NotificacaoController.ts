import type { Request, Response } from "express";
import { NotificacaoService } from "../services/NotificacaoService.js";

const notificacaoService = new NotificacaoService();

export class NotificacaoController {
  async contarNaoLidas(req: Request, res: Response) {
    try {
      // Pega o ID de quem chamou a rota (funciona pra Empresa, Candidato ou Admin)
      const id_usuario = (req.user as any).id;

      if (!id_usuario) {
        return res.status(401).json({ success: false, error: "Usuário não autenticado." });
      }

      const total_nao_lidas = await notificacaoService.contarNaoLidas(id_usuario);

      return res.status(200).json({
        success: true,
        data: {
          total_nao_lidas
        }
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listar(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const notificacoes = await notificacaoService.listarNotificacoes(id_usuario);

      return res.status(200).json({
        success: true,
        data: notificacoes
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async marcarLidas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      if (!id_usuario) {
        return res.status(401).json({ success: false, error: "Usuário não autenticado." });
      }

      await notificacaoService.marcarTodasComoLidas(id_usuario);

      return res.status(200).json({
        success: true,
        message: "Notificações marcadas como lidas."
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}