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
        disponibilidade_sabados,
        disponibilidade_viagem,
        cnh,
        escolaridade,
        competencia,
        pagina,
        limite,
      } = req.query;

      // 🔥 O Pulo do Gato: Força os parâmetros de texto a virarem Arrays
      const parseArray = (param: any): string[] | undefined => {
        if (!param) return undefined;
        // Se vier "A,B", ele fatia e transforma em ["A", "B"]
        return String(param).split(",");
      };

      const resultado = await bancoService.listarVitrine({
        // Numéricos
        id_area: area ? Number(area) : undefined,
        pagina: pagina ? Number(pagina) : undefined,
        limite: limite ? Number(limite) : undefined,

        // Arrays Multi-select (Aqui a mágica resolve o erro do Prisma)
        turno: parseArray(turno),
        cnh: parseArray(cnh),
        escolaridade: parseArray(escolaridade),
        
        // Array de números para as competências
        competencia: parseArray(competencia)?.map((num) => Number(num)),

        // Booleanos seguros
        primeiro_emprego:
          primeiro_emprego === "true"
            ? true
            : primeiro_emprego === "false"
              ? false
              : undefined,
        pcd: pcd === "true" ? true : pcd === "false" ? false : undefined,
        disponibilidade_sabados:
          disponibilidade_sabados === "true"
            ? true
            : disponibilidade_sabados === "false"
              ? false
              : undefined,
        disponibilidade_viagem:
          disponibilidade_viagem === "true"
            ? true
            : disponibilidade_viagem === "false"
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

  // Adicione dentro da sua BancoTalentosController
  async detalharCurriculo(req: Request, res: Response) {
    try {
      const { id_candidato } = req.params;
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
      // Se não achar o candidato (ou ele estiver oculto), devolve 404
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
      );

      return res.status(200).json({
        success: true,
        message: "Currículo desbloqueado com sucesso! 1 crédito foi consumido.",
        data: resultado, // Retorna os dados do candidato já com telefone/email liberados
      });
    } catch (error: any) {
      // Captura o erro específico de saldo e joga o 403
      if (error.message === "SALDO_INSUFICIENTE") {
        return res.status(403).json({
          success: false,
          error:
            "Saldo de créditos insuficiente. Adquira mais créditos para continuar.",
        });
      }

      // Para os outros erros (ex: já desbloqueado), joga 400 normal
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarGaveta(req: Request, res: Response) {
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

      if (!id_empresa_real) {
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito a empresas." });
      }

      const resultado = await bancoService.listarMeusDesbloqueados(id_empresa_real);

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

  // Adicionar aos métodos do seu controller atual
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

      if (!id_empresa_real)
        return res
          .status(403)
          .json({ success: false, error: "Acesso restrito." });

      const resultado = await bancoService.listarCurriculosSalvos(id_empresa_real);

      return res
        .status(200)
        .json({ success: true, total: resultado.length, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
