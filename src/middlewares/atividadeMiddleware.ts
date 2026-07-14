// middlewares/atividadeMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";

const cacheAtividade = new Map<number, number>();

const TEMPO_THROTTLE = 5 * 60 * 1000;

export function registrarAtividadeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {

    next();

    const id_usuario = req.user?.id;

    if (!id_usuario) return;

    const agora = Date.now();
    const ultimaGravacao = cacheAtividade.get(id_usuario) || 0;

    if (agora - ultimaGravacao < TEMPO_THROTTLE) {
      return;
    }

    cacheAtividade.set(id_usuario, agora);

    prisma.usuario
      .update({
        where: { id_usuario },
        data: { ultima_atividade: new Date() },
        select: { id_usuario: true },
      })
      .catch((err) => {

        console.error(
          `[ATIVIDADE] Erro ao atualizar atividade do usuário ${id_usuario}:`,
          err.message,
        );
      });
  };
}
