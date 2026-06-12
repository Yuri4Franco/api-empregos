import type { Request, Response } from "express";
import { EmailService } from "../services/EmailService.js";

const emailService = new EmailService();

export class ContatoController {
  async enviarContato(req: Request, res: Response) {
    try {
      const { nome, email, assunto, mensagem } = req.body;

      // Dispara o e-mail
      await emailService.enviarEmailContatoEmpresa(nome, email, assunto, mensagem);

      return res.status(200).json({
        success: true,
        message: "Sua mensagem foi enviada com sucesso! Em breve nossa equipe entrará em contato.",
      });
    } catch (error: any) {
      console.error("Erro ao enviar e-mail de contato:", error);
      return res.status(500).json({
        success: false,
        error: "Não foi possível enviar sua mensagem no momento. Tente novamente mais tarde.",
      });
    }
  }
}

export const contatoController = new ContatoController();