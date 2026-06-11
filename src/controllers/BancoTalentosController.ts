import type { Request, Response } from "express";
import { BancoTalentosService } from "../services/BancoTalentosService.js";
import { prisma } from "../config/prisma.js";

const bancoService = new BancoTalentosService();

export class BancoTalentosController {
  async listar(req: Request, res: Response) {
    try {
      const {
        area,
        turno,
        primeiro_emprego,
        pcd,
        sabados,
        viagem,
        cnh,
        escolaridade,
        competencia,
        pagina,
        limite,
        genero,
        idade_min,
        idade_max,
      } = req.query;

      const parseArray = (param: any): string[] | undefined => {
        if (!param) return undefined;
        return String(param).split(",");
      };

      const resultado = await bancoService.listarVitrine({
        id_area: area ? Number(area) : undefined,
        pagina: pagina ? Number(pagina) : undefined,
        limite: limite ? Number(limite) : undefined,
        turno: parseArray(turno),
        cnh: parseArray(cnh),
        escolaridade: parseArray(escolaridade),
        competencia: parseArray(competencia)?.map((num) => Number(num)),

        // ✨ REPASSANDO PARA O SERVICE
        genero: genero ? String(genero) : undefined,
        idade_min: idade_min ? Number(idade_min) : undefined,
        idade_max: idade_max ? Number(idade_max) : undefined,

        primeiro_emprego:
          primeiro_emprego === "true"
            ? true
            : primeiro_emprego === "false"
              ? false
              : undefined,
        pcd: pcd === "true" ? true : pcd === "false" ? false : undefined,
        sabados:
          sabados === "true"
            ? true
            : sabados === "false"
              ? false
              : undefined,
        viagem:
          viagem === "true"
            ? true
            : viagem === "false"
              ? false
              : undefined,
      });

      return res.status(200).json({
        success: true,
        ...resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async detalharCurriculo(req: Request, res: Response) {
    try {
      const { id_candidato } = req.params;
      const id_usuario = (req.user as any).id;
      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });

      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }
      const id_empresa_real = vinculo.id_empresa;

      if (!id_empresa_real) {
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito a empresas." });
      }

      if (!id_candidato || isNaN(Number(id_candidato))) {
        return res
          .status(400)
          .json({ success: false, error: "ID de candidato inválido." });
      }

      const resultado = await bancoService.obterCurriculo(
        Number(id_candidato),
        id_empresa_real,
      );

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (error: any) {
      if (error.message.includes("não está disponível")) {
        return res.status(404).json({ success: false, error: error.message });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async desbloquear(req: Request, res: Response) {
    try {
      const { id_candidato } = req.params;
      const id_usuario = (req.user as any).id;

      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });

      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }
      const id_empresa_real = vinculo.id_empresa;

      if (!id_empresa_real) {
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito a empresas." });
      }

      if (!id_candidato || isNaN(Number(id_candidato))) {
        return res
          .status(400)
          .json({ success: false, error: "ID de candidato inválido." });
      }

      const resultado = await bancoService.desbloquearCurriculoTransacao(
        Number(id_candidato),
        id_empresa_real,
        id_usuario,
      );

      return res.status(200).json({
        success: true,
        message: "Currículo desbloqueado com sucesso! 1 crédito foi consumido.",
        data: resultado,
      });
    } catch (error: any) {
      if (error.message === "SALDO_INSUFICIENTE") {
        return res.status(403).json({
          success: false,
          error:
            "Saldo de créditos insuficiente. Adquira mais créditos para continuar.",
        });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarGaveta(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });

      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }
      const id_empresa_real = vinculo.id_empresa;

      if (!id_empresa_real) {
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito a empresas." });
      }

      const resultado =
        await bancoService.listarMeusDesbloqueados(id_empresa_real);

      return res.status(200).json({
        success: true,
        total: resultado.length,
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarAreasDash(req: Request, res: Response) {
    try {
      const resultado = await bancoService.listarAreasComContagem();

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async alternarFavorito(req: Request, res: Response) {
    try {
      const { id_candidato } = req.params;
      const id_usuario = (req.user as any).id;

      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });
      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }
      const id_empresa_real = vinculo.id_empresa;

      if (!id_empresa_real)
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito." });

      const resultado = await bancoService.alternarCurriculoSalvo(
        Number(id_candidato),
        id_empresa_real,
      );

      return res.status(200).json({ success: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarFavoritos(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      const vinculo = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true },
      });
      if (!vinculo || !vinculo.id_empresa) {
        return res.status(403).json({
          success: false,
          error: "Acesso negado. Usuário não vinculado a uma empresa.",
        });
      }
      const id_empresa_real = vinculo.id_empresa;

      if (!id_empresa_real)
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito." });

      const resultado =
        await bancoService.listarCurriculosSalvos(id_empresa_real);

      return res
        .status(200)
        .json({ success: true, total: resultado.length, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
