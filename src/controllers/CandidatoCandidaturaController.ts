import type { Request, Response } from "express";
import { CandidatoCandidaturaService } from "../services/CandidatoCandidaturaService.js";
import { StatusCandidatura } from "@prisma/client";

const candidatoCandidaturaService = new CandidatoCandidaturaService();

export class CandidatoCandidaturaController {
  // ==========================================
  // GETS
  // ==========================================

  async verificarStatus(req: Request, res: Response) {
    try {
      const id_candidato = (req.user as any).id;

      const id_vaga_param = req.params.id_vaga as string;

      if (!id_vaga_param) {
        return res.status(400).json({
          success: false,
          error: "O ID da vaga é obrigatório.",
        });
      }

      const id_vaga = parseInt(id_vaga_param);

      if (isNaN(id_vaga)) {
        return res.status(400).json({
          success: false,
          error: "O ID da vaga informado é inválido.",
        });
      }
      const resultado = await candidatoCandidaturaService.verificarInscricao(
        id_candidato,
        id_vaga,
      );

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async aplicar(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const user = req.user as any;

      const candidatura = await candidatoCandidaturaService.candidatar(
        Number(id_vaga),
        user.id,
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

  async listarMinhasCandidaturas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      if (!id_usuario) {
        return res
          .status(401)
          .json({ success: false, error: "Usuário não autenticado." });
      }

      const dados =
        await candidatoCandidaturaService.listarHistoricoCompleto(id_usuario);

      return res.status(200).json({
        success: true,
        total: dados.length,
        data: dados,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async desistir(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_usuario = (req.user as any).id;

      if (!id_candidatura || isNaN(Number(id_candidatura))) {
        return res
          .status(400)
          .json({ success: false, error: "ID de candidatura inválido." });
      }

      await candidatoCandidaturaService.desistirCandidatura(
        Number(id_candidatura),
        id_usuario,
      );

      return res.status(200).json({
        success: true,
        message:
          "Sua candidatura foi cancelada com sucesso. A empresa será notificada.",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
