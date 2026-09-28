import type { Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";
import { validarRecaptcha } from "../utils/validarRecaptcha.js";

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      let { email, senha, cpf } = req.body;

      // Padroniza o e-mail removendo espaços e passando para minúsculo (igual ao Zod)
      if (email) {
        email = email.trim().toLowerCase();
      }

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
      const { nome, email, cpf, senha, whatsapp, recaptchaToken } = req.body;

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
        whatsapp,
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

  async confirmarEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        throw new Error("Token de confirmação não fornecido.");
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

  async enviarLinkConfirmacao(req: Request, res: Response) {
    try {
      console.log("📍 [1] Chegou no Controller");
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "O e-mail é obrigatório.",
        });
      }

      console.log("📍 [2] Vai chamar o Service");
      await authService.enviarLinkConfirmacao(email);

      console.log("📍 [5] Voltou do Service com sucesso. Enviando 200...");
      return res.status(200).json({
        success: true,
        message: "Um novo link de confirmação foi enviado para o seu e-mail.",
      });
    } catch (error: any) {
      console.log("🚨 Caiu no Catch do Controller!", error);
      return res.status(400).json({
        error: error.message || "Erro ao processar o envio do e-mail.",
      });
    }
  }

  async esqueciSenha(req: Request, res: Response) {
    try {
      let { email } = req.body;

      // Valida se o e-mail foi enviado na requisição
      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Informe o e-mail para recuperar a senha.",
        });
      }

      // Padroniza o e-mail (remove espaços em branco e passa para minúsculo)
      email = email.trim().toLowerCase();

      await authService.solicitarRecuperacaoSenha(email);

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
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
