import type { Request, Response } from "express";
import { CandidaturaService } from "../services/CandidaturaService.js";
import { StatusCandidatura } from "@prisma/client";
import { prisma } from "../config/prisma.js";

const candidaturaService = new CandidaturaService();

export class CandidaturaController {

  async obterPainelGestao(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
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

      const dadosPainel = await candidaturaService.obterPainelGestao(
        Number(id_vaga),
        id_empresa_real,
      );

      return res.status(200).json({
        success: true,
        data: dadosPainel,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }


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
      const { id_candidatura } = req.params;
      const { id_etapa_destino } = req.body;
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

      const resultado = await candidaturaService.moverCandidato(
        Number(id_candidatura),
        Number(id_etapa_destino),
        id_empresa_real,
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
   * Move um candidato individual entre etapas
   */

  /**
   * Reprova múltiplos candidatos de uma só vez (Triagem em Massa) [cite: 247, 267]
   */
  async reprovarEmLote(req: Request, res: Response) {
    try {
      const { id_candidaturas, motivo } = req.body;
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

      await candidaturaService.reprovarEmMassa(
        id_candidaturas,
        motivo,
        id_empresa_real,
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

      await candidaturaService.processarNotificacoesPendentes(
        Number(id_vaga),
        id_empresa_real,
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

  async verPerfil(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
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

      const perfil = await candidaturaService.obterPerfilCompleto(
        Number(id_candidatura),
        id_empresa_real,
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

      const config = await candidaturaService.atualizarPreferenciaDestaque(
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

      const avaliacao = await candidaturaService.avaliarCandidatura(
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

  async verHistorico(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      const historico = await candidaturaService.obterHistoricoCandidatura(
        Number(id_candidatura),
        id_empresa,
      );

      return res.json({
        success: true,
        data: historico,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

    async agendar(req: Request, res: Response) {
      try {
        const { id_candidatura } = req.params;
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
  
        // O middleware de rota já validou o body, mas garantimos a tipagem aqui
        const dadosAgendamento = req.body;
  
        const agendamento = await candidaturaService.agendarEntrevista(
          Number(id_candidatura),
          id_empresa_real,
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
