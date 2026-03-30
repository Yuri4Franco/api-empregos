import type { Request, Response } from "express";
import { VagaService } from "../services/VagaService.js";
import { vagaSchema } from "../schemas/auth.schema.js";

const vagaService = new VagaService();

export class AdminVagaController {
  /**
   * POST /admin/vagas
   * Cadastro Assistido (Balcão) - [cite: 14]
   * Admin cadastra para uma empresa e a vaga já nasce ATIVA.
   */
  async adminCadastrarVaga(req: Request, res: Response) {
    try {
      // 1. Validação pelo Zod
      const dadosValidados = vagaSchema.parse(req.body);

      // 2. No balcão, o ID da empresa alvo vem no corpo da requisição
      const { id_empresa_alvo } = dadosValidados;

      if (!id_empresa_alvo) {
        return res.status(400).json({
          success: false,
          error:
            "O ID da empresa alvo é obrigatório para o cadastro assistido. ",
        });
      }

      // 3. Chamamos o Service com a flag is_admin = true
      const vaga = await vagaService.criarVaga(
        dadosValidados,
        Number(id_empresa_alvo),
        true,
      );

      return res.status(201).json({
        success: true,
        message: "Vaga cadastrada e publicada via balcão com sucesso. ",
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async adminAtualizarVaga(req: Request, res: Response) {
    try {
      const { id } = req.params as any;
      const dadosValidados = vagaSchema.parse(req.body);

      const vaga = await vagaService.atualizarVaga(
        Number(id),
        null, // Admin ignora trava de dono da empresa
        dadosValidados,
        true, // is_admin = true
        req.user.id,
      );

      return res.status(200).json({
        success: true,
        message: "Vaga editada pelo administrador com sucesso.",
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarPendentes(req: Request, res: Response) {
    try {
      // Apenas ADM acessa a fila de moderação
      const resultado = await vagaService.listarVagasPendentes(req.query);

      return res.status(200).json(resultado);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // PATCH /admin/vagas/:id/moderacao
  async moderar(req: Request, res: Response) {
    try {
      const { id } = req.params as any; // Validado pelo IdParamSchema
      const { acao, motivo } = req.body; // Validado pelo ModeracaoVagaSchema
      const idAutor = req.user.id;

      if (acao === "REPROVAR" && !motivo) {
        throw new Error(
          "Ao reprovar uma vaga, você deve informar o motivo para a empresa. ",
        );
      }

      const novoStatus = acao === "APROVAR" ? "ATIVA" : "REPROVADA";

      const vaga = await vagaService.moderarVaga(
        id,
        novoStatus,
        motivo || null,
        idAutor,
      );

      return res.status(200).json({
        message: `Vaga ${acao === "APROVAR" ? "aprovada e publicada" : "reprovada"} com sucesso.`,
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
