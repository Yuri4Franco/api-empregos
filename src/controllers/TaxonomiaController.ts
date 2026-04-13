import type { Request, Response } from "express";
import { TaxonomiaService } from "../services/TaxonomiaService.js";

const taxonomiaService = new TaxonomiaService();

export class TaxonomiaController {
  // --- GESTÃO DE ÁREAS DE ATUAÇÃO ---
  async listarAreas(req: Request, res: Response) {
    try {
      const dados = await taxonomiaService.gerenciarAreas("LISTAR");
      return res.status(200).json(dados);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async criarArea(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      const novo = await taxonomiaService.gerenciarAreas("CRIAR", { nome });
      return res.status(201).json({ success: true, data: novo });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: "Erro ao criar área de atuação." });
    }
  }

  async excluirArea(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await taxonomiaService.gerenciarAreas("DELETAR", { id: Number(id) });
      return res
        .status(200)
        .json({ success: true, message: "Área removida com sucesso." });
    } catch (error: any) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Não é possível excluir uma área vinculada a vagas ou candidatos.",
        });
    }
  }

  // --- GESTÃO DE BENEFÍCIOS ---
  async listarBeneficios(req: Request, res: Response) {
    try {
      const dados = await taxonomiaService.gerenciarBeneficios("LISTAR");
      return res.status(200).json(dados);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async criarBeneficio(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      const novo = await taxonomiaService.gerenciarBeneficios("CRIAR", {
        nome,
      });
      return res.status(201).json({ success: true, data: novo });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: "Erro ao criar benefício padrão." });
    }
  }

  async excluirBeneficio(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await taxonomiaService.gerenciarBeneficios("DELETAR", { id: Number(id) });
      return res
        .status(200)
        .json({ success: true, message: "Benefício removido com sucesso." });
    } catch (error: any) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Não é possível excluir um benefício vinculado a vagas ou empresas.",
        });
    }
  }
}
