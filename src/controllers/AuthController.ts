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
        data: result
      });
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }
}