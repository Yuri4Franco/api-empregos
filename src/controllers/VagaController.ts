import type { Request, Response } from "express";
import { VagaService } from "../services/VagaService.js";
import { vagaSchema } from "../schemas/auth.schema.js"; // Importando o Zod que corrigimos
import type { ModeloTrabalho } from "@prisma/client";

const vagaService = new VagaService();

export class VagaController {
  /**
   * POST /vagas
   * Usado pelo Portal da Empresa.
   * Pode salvar como RASCUNHO ou enviar para análise da ACI.
   */
  async cadastrar(req: Request, res: Response) {
    try {
      // 1. Usamos os dados que o Zod já validou e transformou
      const dadosValidados = vagaSchema.parse(req.body);

      // 2. Pegamos o id_empresa do usuário logado (token)
      const idEmpresa = (req.user as any).id_empresa;

      if (!idEmpresa) {
        return res.status(403).json({
          success: false,
          error: "Usuário não está vinculado a uma conta de empresa.",
        });
      }

      // 3. Passamos 'dadosValidados' para o Service
      const vaga = await vagaService.criarVaga(
        dadosValidados,
        idEmpresa,
        false,
      );

      const mensagem =
        vaga.status === "EM_ANALISE"
          ? "Vaga enviada para aprovação da ACI com sucesso! "
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

  async atualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const idEmpresa = (req.user as any).id_empresa;

      // O Zod valida o corpo da requisição conforme o schema do Wizard
      const dadosValidados = vagaSchema.parse(req.body);

      // CORREÇÃO: Passar argumentos na ordem correta
      const vaga = await vagaService.atualizarVaga(
        Number(id), // 1. id_vaga
        idEmpresa, // 2. id_empresa (Trava de dono)
        dadosValidados, // 3. dados (O objeto com os campos da vaga)
        false, // 4. is_admin (Empresa enviando = false)
      );

      const mensagem = dadosValidados.enviar_para_aprovacao
        ? "Vaga enviada para aprovação da ACI!"
        : "Progresso da vaga salvo como rascunho.";

      return res.status(200).json({
        success: true,
        message: mensagem,
        data: vaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
  /**
   * GET /vagas/minhas
   * Painel da Empresa: Lista apenas as vagas dela - [cite: 96, 207]
   */
  async listarMinhasVagas(req: Request, res: Response) {
    try {
      const idEmpresa = (req.user as any).id_empresa;

      if (!idEmpresa) {
        return res
          .status(403)
          .json({ error: "Usuário não vinculado a uma empresa." });
      }

      // req.query já validado pelo FiltroVagasEmpresaSchema
      const resultado = await vagaService.listarVagasPorEmpresa(
        idEmpresa,
        req.query,
      );

      return res.status(200).json(resultado);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async listarPublicas(req: Request, res: Response) {
    try {
      const { cidade, uf, area, modelo, pagina, bairro } = req.query;

      const filtros: any = {};

      if (cidade) filtros.cidade = cidade as string;
      if (uf) filtros.uf = uf as string;
      if (area) filtros.id_area_atuacao = Number(area);
      if (bairro) filtros.id_bairro = Number(bairro);
      if (modelo) filtros.modelo = modelo as ModeloTrabalho;

      filtros.pagina = pagina ? Number(pagina) : 1;

      const resultado = await vagaService.listarVagasPublicas(filtros);

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
