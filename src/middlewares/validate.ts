import type { Request, Response, NextFunction } from "express";
import { ZodError, z, type ZodTypeAny } from "zod";

export const validate =
  (schema: ZodTypeAny, source: "body" | "query" | "params" = "body") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Validamos os dados
      const validatedData = await schema.parseAsync(req[source]);

      // 2. Em vez de req[source] = validatedData (que dá erro no getter),
      // nós vamos mesclar ou atribuir as propriedades para contornar a proteção do Express
      if (source === "query" || source === "params") {
        // Removemos o que tinha antes e colocamos os dados validados/convertidos
        Object.keys(req[source]).forEach(
          (key) => delete (req[source] as any)[key],
        );
        Object.assign(req[source] as any, validatedData);
      } else {
        // No body geralmente não há esse bloqueio de getter
        req.body = validatedData;
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Erro de validação",
          origem: source,
          detalhes: error.issues.map((e: z.ZodIssue) => ({
            campo: e.path.join("."),
            mensagem: e.message,
          })),
        });
      }

      console.error("ERRO NO MIDDLEWARE DE VALIDAÇÃO:", error);

      return res.status(500).json({
        error: "Erro interno no servidor de validação.",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
