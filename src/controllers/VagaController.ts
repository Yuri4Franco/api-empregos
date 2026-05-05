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
      // 1. Descobrimos se é para mandar pra ACI ou se é só Rascunho
      const isSubmissao = req.body.enviar_para_aprovacao === true;

      let dadosValidados;

      if (isSubmissao) {
        // PASSTHROUGH VITAL: Deixa passar as chaves de etapas que o Front manda
        dadosValidados = vagaSchema.passthrough().parse(req.body);
      } else {
        // Validação de Rascunho: Transforma TUDO em opcional, EXCETO o título
        const rascunhoSchema = vagaSchema.partial().passthrough().extend({
          titulo: vagaSchema.shape.titulo,
        });

        // Parse flexível
        dadosValidados = rascunhoSchema.parse(req.body);
      }

      // 2. Pegamos o ID do usuário logado (token)
      const id_usuario = (req.user as any).id;

      // 3. Buscamos no banco a qual empresa esse usuário pertence
      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });

      // 4. Verificação de segurança
      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const id_empresa_real = vinculo.id_empresa;

      // 5. Passamos 'dadosValidados' para o Service
      const vaga = await vagaService.criarVaga(
        dadosValidados,
        id_empresa_real,
        false, // is_admin
      );

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
      // 🚀 AQUI ESTÁ A CORREÇÃO DE OURO 🚀
      // Verifica se é erro do Zod checando se tem a propriedade "issues" ou "errors"
      const isZodError =
        error.name === "ZodError" || error.issues || error.errors;

      if (isZodError) {
        const listaErros = error.issues || error.errors || [];

        const mensagens = listaErros
          .map((err: any) => {
            const caminho = err.path ? err.path.join(".") : "Campo";
            return `${caminho}: ${err.message}`;
          })
          .join(" | ");

        return res.status(400).json({
          success: false,
          error: `O Zod bloqueou: ${mensagens}`,
          detalhes: listaErros,
        });
      }

      // Se não for erro do Zod (Prisma, Service, etc), cai aqui normal
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
      const parametroId = req.params.id || req.params.id_vaga;
      const id_vaga = parseInt(parametroId as string);

      // Trava de segurança: Se não for um número válido, a gente já barra aqui!
      if (isNaN(id_vaga)) {
        return res.status(400).json({
          success: false,
          error: "ID da vaga fornecido na URL é inválido.",
        });
      }
      const id_usuario = (req.user as any).id;
      const is_admin = (req.user as any).tipo_usuario === "ADM";

      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });

      // 2. Verificação de segurança
      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }

      const id_empresa_real = vinculo.id_empresa;
      const isSubmissao = req.body.enviar_para_aprovacao === true;
      let dadosValidados;

      if (isSubmissao) {
        dadosValidados = vagaSchema.passthrough().parse(req.body);
      } else {
        const rascunhoSchema = vagaSchema.partial().passthrough();
        dadosValidados = rascunhoSchema.parse(req.body);
      }

      const vaga = await vagaService.atualizarVaga(
        Number(id_vaga),
        is_admin ? null : id_empresa_real,
        dadosValidados,
        is_admin,
        id_usuario,
      );

      return res.status(200).json({
        success: true,
        message: "Vaga atualizada com sucesso!",
        data: vaga,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: "Erro de validação.",
          detalhes: error.errors,
        });
      }
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
      // Extrai TODOS os filtros da Query String
      const {
        busca,
        cidade,
        pagina,
        limite,
        modelo_trabalho,
        tipo_contrato,
        somente_pcd,
        nivel_hierarquico,
        salario_min,
        salario_max,
        tipo_pcd,
        id_area_atuacao,
      } = req.query;

      const resultado = await vagaService.listarVagasPublicas({
        busca: busca as string,
        cidade: cidade as string,
        pagina: pagina ? Number(pagina) : undefined,
        limite: limite ? Number(limite) : undefined,
        modelo_trabalho: modelo_trabalho as string,
        tipo_contrato: tipo_contrato as string,
        somente_pcd: somente_pcd === "true", // Converte string 'true' para boolean
        nivel_hierarquico: nivel_hierarquico as string,
        salario_min: salario_min ? Number(salario_min) : undefined,
        salario_max: salario_max ? Number(salario_max) : undefined,
        tipo_pcd: tipo_pcd as string,
        id_area_atuacao: id_area_atuacao as string,
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
        return res
          .status(400)
          .json({ success: false, error: "ID da vaga inválido." });
      }

      const detalhesVaga = await vagaService.obterDetalhesVagaPublica(
        Number(id),
      );

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

  async listarAdmin(req: Request, res: Response) {
    try {
      const { busca, status, id_empresa, pagina, limite } = req.query;

      const resultado = await vagaService.listarTodasVagasAdmin({
        busca: busca as string | undefined,
        status: status as string | undefined,
        id_empresa: id_empresa ? Number(id_empresa) : undefined,
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

  async filtrosDisponiveis(req: Request, res: Response) {
    try {
      const filtros = await vagaService.obterFiltrosDisponiveis();

      return res.status(200).json({
        success: true,
        data: filtros,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar filtros disponíveis.",
      });
    }
  }
}
