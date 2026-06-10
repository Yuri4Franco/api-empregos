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

      return res.status(201).json({
        success: true,
        message:
          "Cadastro realizado com sucesso! Verifique seu e-mail para ativar a conta.",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async ativar(req: Request, res: Response) {
    try {

      const { token } = req.body;

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

  async reenviarAtivacao(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "O e-mail é obrigatório.",
        });
      }

      await authService.reenviarLinkAtivacao(email);

      return res.status(200).json({
        success: true,
        message: "Um novo link de ativação foi enviado para o seu e-mail.",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async esqueciSenha(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      await authService.solicitarRecuperacaoSenha(email);

      // Sempre retorna sucesso, mesmo se o email for inválido (medida de segurança)
      return res.status(200).json({
        success: true,
        message:
          "Se o e-mail estiver cadastrado em nosso sistema, você receberá um link com as instruções para redefinir sua senha em instantes.",
      });
    } catch (error: any) {
      return res
        .status(500)
        .json({
          success: false,
          error: "Erro interno ao processar a solicitação.",
        });
    }
  }

  async redefinirSenha(req: Request, res: Response) {
    try {
      const { token, nova_senha } = req.body;

      await authService.redefinirSenha(token, nova_senha);

      return res.status(200).json({
        success: true,
        message:
          "Sua senha foi redefinida com sucesso! Você já pode fazer login.",
      });
    } catch (error: any) {
      // Vai capturar o erro de "Token inválido ou expirado" lá do Service
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
