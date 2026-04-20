import type { Request, Response } from "express";
import { CandidaturaService } from "../services/CandidaturaService.js";
import { StatusCandidatura } from "@prisma/client";
import { prisma } from "../config/prisma.js";

const candidaturaService = new CandidaturaService();

export class CandidaturaController {
  async aplicar(req: Request, res: Response) {
    try {
      const {id_vaga } = req.params;
      const user = req.user as any;

      const candidatura = await candidaturaService.candidatar(
        Number(id_vaga),
        user.id
      );

      const mensagem =
        candidatura.status_atual === StatusCandidatura.REPROVADO
          ? "Candidatura registrada. Infelizmente você não atende aos requisitos críticos desta vaga no momento."
          : "Inscrição realizada com sucesso! Acompanhe seu status pelo painel.";

      return res.status(201).json({
        success: true,
        message: mensagem,
        data: candidatura,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async mover(req: Request, res: Response) {
    try {
      const { id_candidatura, id_etapa_destino, status_destino, motivo } =
        req.body;
      const user = req.user as any;

      // Apenas EMPRESA ou ADM podem mover candidatos
      if (user.role !== "EMPRESA" && user.role !== "ADM") {
        return res
          .status(403)
          .json({ message: "Sem permissão para mover candidatos." });
      }

      const resultado = await candidaturaService.moverCandidato({
        id_candidatura: Number(id_candidatura),
        id_etapa_destino: Number(id_etapa_destino),
        status_destino, // Deve ser um valor do Enum StatusCandidatura
        motivo,
      });

      return res.status(200).json({
        success: true,
        message: "Candidato movimentado com sucesso!",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarNotificacoes(req: Request, res: Response) {
    try {
      const user = req.user as any;

      const notificacoes = await prisma.notificacao.findMany({
        where: { id_usuario: user.id },
        orderBy: { criado_em: "desc" },
        take: 20, // Pegamos apenas as últimas 20
      });

      return res.status(200).json({ success: true, data: notificacoes });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async marcarLida(req: Request, res: Response) {
    try {
      const { id_notificacao } = req.params;
      const user = req.user as any;

      await prisma.notificacao.updateMany({
        where: { id_notificacao: Number(id_notificacao), id_usuario: user.id },
        data: { lida: true },
      });

      return res
        .status(200)
        .json({ success: true, message: "Notificação lida." });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async desistir(req: Request, res: Response) {
    try {
      const id_candidato = (req.user as any).id;
      const { id_candidatura } = req.params;

      await candidaturaService.desistirCandidatura(
        Number(id_candidatura),
        id_candidato,
      );

      return res.json({
        success: true,
        message: "Você desistiu deste processo seletivo com sucesso.",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
