import type { Request, Response } from "express"
import { TaxonomiaService } from "../services/TaxonomiaService";

const taxonomiaService = new TaxonomiaService();

export class TaxonomiaController {
  // Exemplo para Bairros (Repetir lógica para Áreas e Benefícios)
  async listarBairros(req: Request, res: Response) {
    const dados = await taxonomiaService.gerenciarBairros("LISTAR");
    return res.json(dados);
  }

  async criarBairro(req: Request, res: Response) {
    try {
      const novo = await taxonomiaService.gerenciarBairros("CRIAR", {
        nome: req.body.nome,
      });
      return res.status(201).json(novo);
    } catch (e) {
      return res
        .status(400)
        .json({ error: "Bairro já existe ou dados inválidos" });
    }
  }

  // Áreas
  async listarAreas(req: Request, res: Response) {
    const dados = await taxonomiaService.gerenciarAreas("LISTAR");
    return res.json(dados);
  }

  async criarArea(req: Request, res: Response) {
    try {
      const novo = await taxonomiaService.gerenciarAreas("CRIAR", {
        nome: req.body.nome,
      });
      return res.status(201).json(novo);
    } catch (e) {
      return res.status(400).json({ error: "Área já existe" });
    }
  }

  // Benefícios
  async listarBeneficios(req: Request, res: Response) {
    const dados = await taxonomiaService.gerenciarBeneficios("LISTAR");
    return res.json(dados);
  }

  async criarBeneficio(req: Request, res: Response) {
    try {
      const novo = await taxonomiaService.gerenciarBeneficios("CRIAR", {
        nome: req.body.nome,
      });
      return res.status(201).json(novo);
    } catch (e) {
      return res.status(400).json({ error: "Benefício já existe" });
    }
  }
}
