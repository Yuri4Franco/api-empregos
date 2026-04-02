import type { Request, Response } from "express";
import { CandidatoService } from "../services/CandidatoService.js";

const candidatoService = new CandidatoService();

export class CandidatoController {
  /**
   * Retorna os dados organizados para o quadro visual (Kanban) [cite: 242, 243]
   */
  async index(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      const dadosKanban = await candidatoService.kanban(
        Number(id_vaga),
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        data: dadosKanban,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Move um candidato individual entre etapas
   */
  async mover(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const { id_etapa_destino } = req.body;
      const id_empresa = (req.user as any).id_empresa;

      const resultado = await candidatoService.moverCandidato(
        Number(id_candidatura),
        Number(id_etapa_destino),
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        message:
          "Candidato movido. Notificação aguardando publicação (Safe Send).",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Reprova múltiplos candidatos de uma só vez (Triagem em Massa) [cite: 247, 267]
   */
  async reprovarEmLote(req: Request, res: Response) {
    try {
      const { id_candidaturas, motivo } = req.body;
      const id_empresa = (req.user as any).id_empresa;

      await candidatoService.reprovarEmMassa(
        id_candidaturas,
        motivo,
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        message: `${id_candidaturas.length} candidatos reprovados. Notificações pendentes de publicação.`,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Dispara as notificações reais para os candidatos (Botão Publicar)
   */
  async publicarNotificacoes(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      await candidatoService.processarNotificacoesPendentes(
        Number(id_vaga),
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        message: "Notificações enviadas com sucesso!",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Agenda uma entrevista e libera a notificação pendente (Safe Send)
   */
  async agendar(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      // O middleware de rota já validou o body, mas garantimos a tipagem aqui
      const dadosAgendamento = req.body;

      const agendamento = await candidatoService.agendarEntrevista(
        Number(id_candidatura),
        id_empresa,
        {
          ...dadosAgendamento,
          data_hora: new Date(dadosAgendamento.data_hora),
        },
      );

      return res.status(200).json({
        success: true,
        message:
          "Entrevista agendada com sucesso! O convite será enviado ao publicar as notificações.",
        data: agendamento,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async verPerfil(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      const perfil = await candidatoService.obterPerfilCompleto(
        Number(id_candidatura),
        id_empresa,
      );
      return res.json({ success: true, data: perfil });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async salvarConfiguracaoDestaques(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const { campos } = req.body;
      const id_empresa = (req.user as any).id_empresa;

      const config = await candidatoService.atualizarPreferenciaDestaque(
        Number(id_vaga),
        id_empresa,
        campos,
      );

      return res.status(200).json({
        success: true,
        message: "Preferências de visualização atualizadas!",
        data: config,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async avaliar(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = (req.user as any).id_empresa;
      const { pontuacao, observacoes_internas, tags_avaliacao } = req.body;

      const avaliacao = await candidatoService.avaliarCandidatura(
        Number(id_candidatura),
        id_empresa,
        { pontuacao, observacoes_internas, tags_avaliacao },
      );

      return res.json({
        success: true,
        message: "Avaliação salva!",
        data: avaliacao,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
