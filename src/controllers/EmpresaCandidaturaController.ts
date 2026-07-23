import type { Request, Response } from "express";
import { EmpresaCandidaturaService } from "../services/EmpresaCandidaturaService.js";

const empresaCandidaturaService = new EmpresaCandidaturaService();

export class EmpresaCandidaturaController {
  // ==========================================
  // GETS
  // ==========================================

  // ==========================================
  // Painel de Gestão de Candidaturas
  // ==========================================
  async obterPainelGestao(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const dadosPainel = await empresaCandidaturaService.obterPainelGestao(
        Number(id_vaga),
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        data: dadosPainel,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==========================================
  // Perfil do Candidato
  // ==========================================
  async verPerfil(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const perfil = await empresaCandidaturaService.obterPerfilCompleto(
        Number(id_candidatura),
        id_empresa,
      );
      return res.json({ success: true, data: perfil });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==========================================
  // Histórico de Candidatura (Timeline)
  // ==========================================
  async verHistorico(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const historico =
        await empresaCandidaturaService.obterHistoricoCandidatura(
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

  // ==========================================
  // AÇÕES
  // ==========================================

  // ==========================================
  // Reprovar em lote
  // ==========================================
  async reprovarEmLote(req: Request, res: Response) {
    try {
      const { id_candidaturas } = req.body;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      if (!Array.isArray(id_candidaturas) || id_candidaturas.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum candidato selecionado." });
      }

      await empresaCandidaturaService.reprovarEmMassa(
        id_candidaturas,
        id_empresa,
      );

      return res.status(200).json({
        success: true,
        message: `${id_candidaturas.length} candidato(s) reprovado(s) com sucesso.`,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==========================================
  // Avançar Candidato
  // ==========================================
  async avancar(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const resultado = await empresaCandidaturaService.avancarCandidato(
        Number(id_candidatura),
        id_empresa,
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

  // ==========================================
  // Avançar em Massa
  // ==========================================
  async avancarMassa(req: Request, res: Response) {
    try {
      const { id_candidaturas } = req.body;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      if (!Array.isArray(id_candidaturas) || id_candidaturas.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum candidato selecionado." });
      }

      const resultado = await empresaCandidaturaService.avancarEmMassa(
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

  // ==========================================
  // Salvar Configuração de Destaques
  // ==========================================
  async salvarConfiguracaoDestaques(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const { campos } = req.body;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const config =
        await empresaCandidaturaService.atualizarPreferenciaDestaque(
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

  // ==========================================
  // Avaliar Candidato
  // ==========================================
  async avaliar(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
      const { pontuacao, observacoes_internas, tags_avaliacao } = req.body;
      const id_empresa = req.user.id_empresa;

      if (!id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const avaliacao = await empresaCandidaturaService.avaliarCandidatura(
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

  async buscarCurriculosLote(req: Request, res: Response) {
    try {
      const idEmpresa = req.user.id_empresa;

      if (!idEmpresa) {
        return res.status(403).json({
          error:
            "Acesso negado. Apenas empresas autenticadas podem buscar currículos em lote.",
        });
      }

      // 2. Extrai o array de IDs do body: { "ids": [1, 2, 3] }
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          error: "Por favor, forneça um array de 'ids' válido e não vazio.",
        });
      }

      // 3. Proteção contra ataques de negação de serviço (DoS) por excesso de carga
      if (ids.length > 50) {
        return res.status(400).json({
          error:
            "O lote excede o limite permitido de 50 currículos por requisição.",
        });
      }

      // 4. Executa o serviço convertendo o ID para Number por segurança
      const curriculos = await empresaCandidaturaService.obterCurriculosPorLote(
        Number(idEmpresa),
        ids,
      );

      // 5. Retorna 200 OK
      return res.status(200).json({
        total: curriculos.length,
        data: curriculos,
      });
    } catch (error: any) {
      console.error("Erro ao buscar currículos em lote:", error.message);
      return res.status(500).json({
        error:
          error.message ||
          "Ocorreu um erro interno ao processar o lote de currículos.",
      });
    }
  }
}
