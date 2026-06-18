import type { Request, Response } from "express";
import { VagaService } from "../services/VagaService.js";
import { AdminService } from "../services/AdminService.js";
import { vagaSchema } from "../schemas/auth.schema.js";


const vagaService = new VagaService();
const adminService = new AdminService();

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

  async listarPendencias(req: Request, res: Response) {
    try {
      const resultado = await vagaService.listarVagasPendentesAcao();
      return res.status(200).json({ success: true, ...resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  // PATCH /admin/vagas/:id/moderacao
  async moderar(req: Request, res: Response) {
    try {
      const { id } = req.params as any; // Validado pelo IdParamSchema
      const { acao, motivo } = req.body; // Validado pelo ModeracaoVagaSchema
      const idAutor = req.user.id;
      console.log("Ação de moderação recebida:", { id, acao, motivo, idAutor });

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

  async confirmarPagamento(req: Request, res: Response) {
    try {
      const { id } = req.params as any;
      console.log("Fazendo confirmação de pagamento para vaga ID")
      console.log("ID da vaga para confirmação de pagamento:", id);

      const id_admin = req.user.id;
      
      console.log("ID do admin que está confirmando o pagamento:", id_admin);

      if (!id || isNaN(Number(id))) {
        return res
          .status(400)
          .json({ success: false, error: "ID da vaga inválido." });
      }

      await vagaService.confirmarPagamento(Number(id), id_admin);

      return res.status(200).json({
        success: true,
        message:
          "Pagamento confirmado! A vaga agora está pública para os candidatos.",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async detalharVaga(req: Request, res: Response) {
    const id_vaga = Number(req.params.id);

    if (isNaN(id_vaga)) {
      return res.status(400).json({ error: "ID da vaga inválido." });
    }

    try {
      const vaga = await adminService.detalharVaga(id_vaga);
      return res.status(200).json(vaga);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }
  
}
