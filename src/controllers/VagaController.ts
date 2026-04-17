import type { Request, Response } from "express";
import { VagaService } from "../services/VagaService.js";
import { vagaSchema } from "../schemas/auth.schema.js"; // Importando o Zod que corrigimos
import type { ModeloTrabalho } from "@prisma/client";
import { prisma } from "../config/prisma.js";

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

      if (!id_empresa_real) {
        return res.status(403).json({
          success: false,
          error: "Usuário não está vinculado a uma conta de empresa.",
        });
      }

      // 3. Passamos 'dadosValidados' para o Service
      const vaga = await vagaService.criarVaga(
        dadosValidados,
        id_empresa_real,
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

  async duplicar(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const id_empresa = (req.user as any).id_empresa;

      const novaVaga = await vagaService.duplicarVaga(
        Number(id_vaga),
        id_empresa,
      );

      return res.status(201).json({
        success: true,
        message:
          "Vaga duplicada com sucesso! Verifique o rascunho para publicar.",
        data: novaVaga,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async atualizar(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const id_empresa = (req.user as any).id_empresa;
      const id_usuario = (req.user as any).id_usuario;
      const is_admin = (req.user as any).tipo_usuario === "ADM";

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

      // Passamos id_empresa para a trava de dono, ou null se for Admin
      const vaga = await vagaService.atualizarVaga(
        Number(id_vaga),
        is_admin ? null : id_empresa_real,
        req.body,
        is_admin,
        id_usuario,
      );

      return res.status(200).json({
        success: true,
        message: "Vaga atualizada com sucesso!",
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

      // req.query já validado pelo FiltroVagasEmpresaSchema
      const resultado = await vagaService.listarVagasPorEmpresa(
        id_empresa_real,
        req.query,
      );

      return res.status(200).json(resultado);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
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

  async encerrar(req: Request, res: Response) {
    try {
      const { id_vaga } = req.params;
      const { motivo } = req.body;
      const id_empresa = (req.user as any).id_empresa;

      await vagaService.encerrarVaga(Number(id_vaga), id_empresa, motivo);

      return res.status(200).json({
        success: true,
        message:
          "Vaga encerrada com sucesso. Candidatos pendentes foram movidos para reprovação e aguardam publicação de feedback.",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarPublicas(req: Request, res: Response) {
    try {
      // Extrai os filtros da Query String (a interrogação na URL)
      const { busca, cidade, pagina, limite } = req.query;

      const resultado = await vagaService.listarVagasPublicas({
        busca: busca as string,
        cidade: cidade as string,
        pagina: pagina ? Number(pagina) : undefined,
        limite: limite ? Number(limite) : undefined,
      });

      return res.status(200).json({
        success: true,
        ...resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async detalharPublica(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ success: false, error: "ID da vaga inválido." });
      }

      const detalhesVaga = await vagaService.obterDetalhesVagaPublica(Number(id));

      return res.status(200).json({
        success: true,
        data: detalhesVaga,
      });
    } catch (error: any) {
      // Se não achar a vaga, retornamos 404 (Not Found), o que é ótimo pro Google SEO
      if (error.message === "Vaga não encontrada.") {
        return res.status(404).json({ success: false, error: error.message });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
