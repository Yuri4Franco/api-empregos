import type { Request, Response } from "express";
import { CandidaturaService } from "../services/CandidaturaService.js";
import { StatusCandidatura } from "@prisma/client";
import { prisma } from "../config/prisma.js";

const candidaturaService = new CandidaturaService();

export class CandidaturaController {
  async aplicar(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const user = req.user as any;

      const candidatura = await candidaturaService.candidatar(
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

  async avancar(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;

      // Assumindo que o usuário logado pertence a uma empresa e tem esse ID no token
      const id_usuario = (req.user as any).id;

      // 2. Buscamos no banco a qual empresa esse usuário pertence
      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });

      // 3. Verificação de segurança
      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      // 4. Agora sim, temos o ID real da empresa
      const id_empresa_real = vinculo.id_empresa;

      const resultado = await candidaturaService.avancarCandidato(
        Number(id_candidatura),
        id_empresa_real,
      );

      return res.status(200).json({
        success: true,
        message: "Candidato avançado para a próxima etapa com sucesso!",
        data: resultado,
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

  async avancarMassa(req: Request, res: Response) {
    try {
      const id_empresa = (req as any).usuario.id_empresa;
      const { id_candidaturas } = req.body; // Recebe um array numérico [1, 5, 8]

      if (!id_empresa) {
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito." });
      }

      if (!Array.isArray(id_candidaturas) || id_candidaturas.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum candidato selecionado." });
      }

      const resultado = await candidaturaService.avancarEmMassa(
        id_candidaturas,
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        message: `${resultado.avancados} candidato(s) avançado(s) com sucesso.`,
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async marcarLida(req: Request, res: Response) {
    try {
      const { id_notificacao } = req.params;
      const user = (req.user as any).id;

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

  async listarMinhasCandidaturas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      if (!id_usuario) {
        return res
          .status(401)
          .json({ success: false, error: "Usuário não autenticado." });
      }

      const dados =
        await candidaturaService.listarHistoricoCompleto(id_usuario);

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

      await candidaturaService.desistirCandidatura(
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

  async listarAgendamentos(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      if (!id_usuario) {
        return res
          .status(401)
          .json({ success: false, error: "Usuário não autenticado." });
      }

      const dados = await candidaturaService.listarMeusAgendamentos(id_usuario);

      return res.status(200).json({
        success: true,
        total: dados.length,
        data: dados,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

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
      const resultado = await candidaturaService.verificarInscricao(
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
}
