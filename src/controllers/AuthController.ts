import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, senha, cnpj } = req.body;

      let result;
      if (cnpj) {
        result = await authService.loginEmpresa(cnpj, senha);
      } else {
        result = await authService.loginPorEmail(email, senha);
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const resultado = await authService.registrarCandidato(req.body);

      // Aqui, em produção, você não retornaria o token no JSON,
      // mas enviaria por e-mail silenciosamente. [cite: 41, 53]
      return res.status(201).json({
        success: true,
        message:
          "Cadastro realizado com sucesso! Verifique seu e-mail para ativar a conta.",
        token_simulado_desenvolvimento: resultado.token,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async ativar(req: Request, res: Response) {
    try {
      const token = req.params.token as string;

      if (!token) {
        throw new Error("Token de ativação não fornecido.");
      }

      await authService.confirmarEmail(token);

      return res.status(200).json({
        success: true,
        message: "Sua conta foi ativada! Agora você pode entrar no sistema.",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
