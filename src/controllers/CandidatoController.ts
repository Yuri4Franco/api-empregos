import type { Request, Response } from "express";
import { CandidatoService } from "../services/CandidatoService.js";
import { updateCandidatoSchema } from "../schemas/auth.schema.js";
import { prisma } from "../config/prisma.js";

const candidatoService = new CandidatoService();

export class CandidatoController {
  /**
   * Retorna os dados organizados para o quadro visual
   */
  async index(req: Request, res: Response) {
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

      const dadosKanban = await candidatoService.kanban(
        Number(id_vaga),
        id_empresa_real,
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

      const resultado = await candidatoService.moverCandidato(
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

      await candidatoService.processarNotificacoesPendentes(
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

      const agendamento = await candidatoService.agendarEntrevista(
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

      const perfil = await candidatoService.obterPerfilCompleto(
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

  async verHistorico(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      const historico = await candidatoService.obterHistoricoCandidatura(
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

  async meuCurriculo(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      console.log("ID do usuário autenticado:", id_usuario);

      if (!id_usuario) {
        return res
          .status(401)
          .json({ success: false, error: "Usuário não autenticado." });
      }

      const dadosCurriculo =
        await candidatoService.obterMeuCurriculo(id_usuario);

      return res.status(200).json({
        success: true,
        data: dadosCurriculo,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async actualizar(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const candidatoActualizado = await candidatoService.actualizarDadosGerais(
        id_usuario,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso!",
        data: candidatoActualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async toggleVisibilidade(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const { perfil_visivel_empresas } = req.body;

      const resultado = await candidatoService.atualizarVisibilidade(
        id_usuario,
        perfil_visivel_empresas,
      );

      return res.status(200).json({
        success: true,
        message: perfil_visivel_empresas
          ? "Seu currículo agora está visível para as empresas."
          : "Seu currículo foi ocultado do banco de talentos.",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async uploadFoto(req: Request, res: Response) {
    try {
      console.log("Iniciando upload de foto de perfil...");
      const id_usuario = (req.user as any).id;

      console.log("ID do usuário autenticado para upload de foto:", id_usuario);
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Nenhuma imagem foi enviada.",
        });
      }

      const foto_url = req.file.path;
      console.log("URL da foto recebida:", foto_url);

      const resultado = await candidatoService.atualizarFotoPerfil(
        id_usuario,
        foto_url,
      );

      return res.status(200).json({
        success: true,
        message: "Foto de perfil atualizada com sucesso!",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
