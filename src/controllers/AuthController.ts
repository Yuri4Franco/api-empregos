import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";
import { validarRecaptcha } from "../utils/validarRecaptcha.js";

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, senha, cpf } = req.body;

      // 🚨 1. Trava de segurança: Garante a presença da senha e de pelo menos um identificador
      if (!senha || (!email && !cpf)) {
        return res.status(400).json({
          success: false,
          error:
            "Informe a senha e pelo menos um identificador (E-mail ou CPF).",
        });
      }

      let result;
      if (cpf) {
        result = await authService.loginPorCpf(cpf, senha);
      } else {
        // Como passou pelo if inicial, temos certeza absoluta que 'email' existe aqui
        result = await authService.loginPorEmail(email, senha);
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("Erro na tentativa de login:", error.message);

      const isUnauthorized =
        error.message.includes("Credenciais inválidas") ||
        error.message.includes("Verifique seu email") ||
        error.message.includes("Acesso em análise");

      const statusCode = isUnauthorized ? 401 : 400;

      return res.status(statusCode).json({
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

  async registrarCandidatoCpf(req: Request, res: Response) {
    try {
      const { nome, email, cpf, senha, recaptchaToken } = req.body;

      // Validação básica dos campos obrigatórios
      if (!nome || !email || !cpf || !senha) {
        return res.status(400).json({
          erro: "Todos os campos (nome, email, cpf e senha) são obrigatórios.",
        });
      }

      const isHuman = await validarRecaptcha(recaptchaToken, "register");
      if (!isHuman) {
        return res.status(400).json({
          error:
            "Falha na verificação de segurança (reCAPTCHA). Por favor, recarregue a página e tente novamente.",
        });
      }

      const resultado = await authService.registrarCandidatoComCpf({
        nome,
        email,
        cpf,
        senha,
      });

      // Retorna 201 (Created) entregando o token para login imediato
      return res.status(201).json({
        mensagem: "Cadastro realizado com sucesso!",
        ...resultado,
      });
    } catch (error: any) {
      console.error("Erro no registro rápido de candidato:", error.message);

      // Define 409 (Conflict) se for dado duplicado, ou 400 (Bad Request) para outros erros
      const status = error.message.includes("já está cadastrado") ? 409 : 400;

      return res.status(status).json({
        erro: error.message || "Erro interno ao registrar candidato.",
      });
    }
  }

  async ativar(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        throw new Error("Token de ativação não fornecido.");
      }

      const dadosAutenticacao = await authService.confirmarEmail(token);

      return res.status(200).json({
        success: true,
        message: "Sua conta foi ativada! Agora você pode entrar no sistema.",
        data: dadosAutenticacao,
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
      return res.status(500).json({
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
