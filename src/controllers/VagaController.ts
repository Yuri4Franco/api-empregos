import type { Request, Response } from "express";
import { VagaService } from "../services/VagaService.js";
import { vagaSchema } from "../schemas/auth.schema.js"; // Importando o Zod que corrigimos

const vagaService = new VagaService();

export class VagaController {
  /**
   * POST /vagas
   * Usado pelo Portal da Empresa.
   * Pode salvar como RASCUNHO ou enviar para análise da ACI.
   */
  async cadastrar(req: Request, res: Response) {
    try {
      const dadosValidados = vagaSchema.parse(req.body);
      const user = req.user as any;
      const idEmpresa = user.id_empresa;

      if (!idEmpresa) {
        throw new Error("Usuário não está vinculado a uma conta de empresa.");
      }

      const vaga = await vagaService.criarVaga(req.body, idEmpresa, false);

      const mensagem =
        vaga.status === "EM_ANALISE"
          ? "Vaga enviada para aprovação da ACI com sucesso!"
          : "Rascunho da vaga salvo com sucesso.";

      return res.status(201).json({
        success: true,
        message: mensagem,
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /admin/vagas
   * Cadastro Assistido (Balcão) - [cite: 14]
   * Admin cadastra para uma empresa e a vaga já nasce ATIVA.
   */
  async adminCadastrarVaga(req: Request, res: Response) {
    try {
      const dadosValidados = vagaSchema.parse(req.body);
      const { id_empresa_alvo } = req.body;

      if (!id_empresa_alvo) {
        throw new Error(
          "O ID da empresa alvo é obrigatório para o cadastro assistido.",
        );
      }

      const vaga = await vagaService.criarVaga(
        req.body,
        Number(id_empresa_alvo),
        true,
      );

      return res.status(201).json({
        success: true,
        message: "Vaga cadastrada e publicada via balcão com sucesso.",
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const idVaga = Number(id);
      const dadosValidados = vagaSchema.parse(req.body);
      const user = req.user as any;
      const idEmpresa = user.id_empresa;
      const isAdmin = user.tipo_usuario === "ADM";
      if (!idEmpresa && !isAdmin) {
        throw new Error("Usuário não autorizado.");
      }

      const vaga = await vagaService.atualizarVaga(
        idVaga,
        idEmpresa,
        dadosValidados,
        isAdmin,
      );

      const mensagem =
        vaga.status === "EM_ANALISE"
          ? "Vaga enviada para análise com sucesso!"
          : "Vaga atualizada com sucesso.";

      return res.status(200).json({
        success: true,
        message: mensagem,
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /vagas/minhas
   * Painel da Empresa: Lista apenas as vagas dela - [cite: 96, 207]
   */
  async listarMinhasVagas(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const idEmpresa = user.id_empresa;

      const vagas = await vagaService.listarVagasPorEmpresa(idEmpresa);

      return res.status(200).json({
        success: true,
        data: vagas,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async listarPublicas(req: Request, res: Response) {
    try {
      const { cidade, uf, area, modelo, pagina } = req.query;

      const resultado = await vagaService.listarVagasPublicas({
        cidade: cidade as string,
        uf: uf as string,
        area: area as string,
        modelo: modelo as string,
        pagina: pagina ? Number(pagina) : 1,
      });

      return res.status(200).json({
        success: true,
        data: resultado.vagas,
        meta: {
          totalPaginas: resultado.totalPaginas,
          totalRegistros: resultado.totalRegistros,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async buscarDetalhes(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const idVaga = Number(id);

      if (isNaN(idVaga)) {
        throw new Error("ID da vaga inválido.");
      }

      const vaga = await vagaService.buscarPorId(idVaga);

      return res.status(200).json({
        success: true,
        data: vaga,
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  }

  async listarCandidatos(req: Request, res: Response) {
    try {
      const { id } = req.params; // ID da Vaga
      const user = req.user as any;
      const idEmpresa = user.id_empresa;

      if (!idEmpresa) throw new Error("Acesso restrito a empresas.");

      const dados = await vagaService.listarCandidatosPorVaga(
        Number(id),
        idEmpresa,
      );

      return res.status(200).json({
        success: true,
        data: dados,
      });
    } catch (error: any) {
      return res.status(403).json({ success: false, error: error.message });
    }
  }
}
