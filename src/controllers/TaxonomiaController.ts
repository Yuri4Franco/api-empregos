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


  async editarArea(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nome } = req.body;

      if (!nome) {
        return res.status(400).json({ 
          success: false, 
          error: "O nome da área de atuação é obrigatório." 
        });
      }

      const atualizado = await taxonomiaService.gerenciarAreas("EDITAR", { 
        id: Number(id), 
        nome 
      });

      return res.status(200).json({ success: true, data: atualizado });
    } catch (error: any) {
      // Tratamento específico do Prisma para chave única duplicada
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          success: false, 
          error: "Já existe uma área de atuação cadastrada com este nome." 
        });
      }

      return res.status(400).json({ 
        success: false, 
        error: "Erro ao editar área de atuação." 
      });
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
      return res.status(400).json({
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
      const { descricao } = req.body;
      const novo = await taxonomiaService.gerenciarBeneficios("CRIAR", {
        descricao,
      });
      return res.status(201).json({ success: true, data: novo });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: "Erro ao criar benefício padrão." });
    }
  }

  async editarBeneficio(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { descricao } = req.body; // Puxa como "nome" para manter o padrão do seu front

      if (!descricao) {
        return res.status(400).json({ 
          success: false, 
          error: "A descrição do benefício é obrigatória." 
        });
      }

      const atualizado = await taxonomiaService.gerenciarBeneficios("EDITAR", { 
        id: Number(id), 
        descricao 
      });

      return res.status(200).json({ success: true, data: atualizado });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          success: false, 
          error: "Já existe um benefício cadastrado com esta descrição." 
        });
      }

      return res.status(400).json({ 
        success: false, 
        error: "Erro ao editar benefício." 
      });
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
      return res.status(400).json({
        success: false,
        error:
          "Não é possível excluir um benefício vinculado a vagas ou empresas.",
      });
    }
  }

  async listarPerguntasEliminatorias(req: Request, res: Response) {
    try {
      const perguntas = await taxonomiaService.listarPerguntasEliminatorias();

      return res.json({
        success: true,
        data: perguntas,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarCompetencias(req: Request, res: Response) {
    try {
      const competencias = await taxonomiaService.listarCompetencias();
      return res.json({
        success: true,
        data: competencias,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
  
}
