import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  sub: number;
  role: "CANDIDATO" | "EMPRESA" | "ADM";
  master: boolean;
  id_empresa: number | null; // ✨ Mapeando o que vem do token
  exigir_troca_senha: boolean; // ✨ Mapeando o que vem do token
}

export function authMiddleware(roles?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const jwtSecret = process.env.JWT_SECRET;

    if (typeof jwtSecret !== "string") {
      return res.status(500).json({
        message: "Erro interno: Segredo de autenticação não configurado.",
      });
    }

    if (!authHeader) return res.status(401).json({ message: "Token ausente." });

    const parts = authHeader.split(" ");
    const token = parts[1];

    if (!token) {
      return res.status(401).json({ message: "Token mal formatado." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as unknown as TokenPayload;

      if (roles && !roles.includes(decoded.role)) {
        return res.status(403).json({
          message: "Acesso negado para este perfil.",
        });
      }

      // ✨ Injetando TODOS os dados decodificados no req.user
      req.user = {
        id: decoded.sub,
        role: decoded.role,
        is_master: decoded.master,
        id_empresa: decoded.id_empresa,
        exigir_troca_senha: decoded.exigir_troca_senha,
      };

      return next();
    } catch (err) {
      return res.status(401).json({ message: "Token inválido ou expirado." });
    }
  };
}
