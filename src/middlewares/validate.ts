import type { Request, Response, NextFunction } from "express";
import { ZodError, z, type ZodTypeAny } from "zod";

export const validate =
  (schema: ZodTypeAny, source: "body" | "query" | "params" = "body") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.parseAsync(req[source]);

      if (source === "query" || source === "params") {
        Object.keys(req[source]).forEach(
          (key) => delete (req[source] as any)[key],
        );
        Object.assign(req[source] as any, validatedData);
      } else {
        req.body = validatedData;
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // ✨ A MÁGICA AQUI: Pega a primeira mensagem customizada do Zod
        const mensagemPrincipal = error.issues[0]?.message || "Erro de validação nos dados.";

        return res.status(400).json({
          success: false, // <-- Mantém o padrão de resposta da sua API
          error: mensagemPrincipal, // <-- Agora o front-end vai ler a mensagem certa!
          origem: source,
          detalhes: error.issues.map((e: z.ZodIssue) => ({
            campo: e.path.join("."),
            mensagem: e.message,
          })),
        });
      }

      console.error("ERRO NO MIDDLEWARE DE VALIDAÇÃO:", error);

      return res.status(500).json({
        success: false,
        error: "Erro interno no servidor de validação.",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };