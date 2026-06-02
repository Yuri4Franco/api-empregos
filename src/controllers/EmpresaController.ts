// EmpresaController.ts
import type { Request, Response } from "express";
import { EmpresaService } from "../services/EmpresaService.js";
import { prisma } from "../config/prisma.js";

const empresaService = new EmpresaService();

export class EmpresaController {
  
  async criarSolicitacao(req: Request, res: Response) {
    try {
      const id_empresa = (req.user as any).id_empresa;
      const resultado = await empresaService.solicitarDivulgacao(
        id_empresa,
        req.body,
      );
      return res.status(201).json({ success: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async atualizarPerfil(req: Request, res: Response) {
    try {
      // 1. Pegamos o ID do usuário autenticado no token
      // (Ajuste para .id ou .id_usuario conforme seu middleware)
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

      // 5. Chamamos o Service passando o ID correto e o corpo da requisição
      const empresaAtualizada =
        await empresaService.atualizarPerfilInstitucional(
          id_empresa_real,
          req.body,
        );

      return res.status(200).json({
        success: true,
        message: "Perfil institucional atualizado com sucesso!",
        data: empresaAtualizada,
      });
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error.message);
      return res.status(400).json({
        success: false,
        error: error.message || "Erro interno ao atualizar perfil.",
      });
    }
  }

  async dashboard(req: Request, res: Response) {
    try {
      const id_empresa = (req.user as any).id_empresa;
      // O validate já transformou em número pra gente
      const { periodo_dias } = req.query as any;

      const dados = await empresaService.obterResumoDashboard(
        id_empresa,
        periodo_dias,
      );

      return res.json({ success: true, data: dados });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async atualizarBanner(req: Request, res: Response) {
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

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum banner enviado." });
      }

      const bannerUrl = req.file.path;

      await empresaService.atualizarBannerEmpresa(id_empresa_real, bannerUrl);

      return res.status(200).json({
        success: true,
        message: "Banner atualizado com sucesso!",
        url: bannerUrl,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async atualizarLogo(req: Request, res: Response) {
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

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum logotipo enviado." });
      }

      // A URL gerada com transformação 400x400 fica em req.file.path
      const logoUrl = req.file.path;

      await empresaService.atualizarLogoEmpresa(id_empresa_real, logoUrl);

      return res.status(200).json({
        success: true,
        message: "Logotipo atualizado com sucesso!",
        url: logoUrl,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async meuPerfil(req: Request, res: Response) {
    try {
      // No seu middleware, o ID costuma ser salvo em req.user.id
      const id_usuario = (req.user as any).id;

      const empresa =
        await empresaService.obterDadosEmpresaPorUsuario(id_usuario);

      return res.json({
        success: true,
        data: empresa,
      });
    } catch (error: any) {
      console.error("Erro no meuPerfil:", error.message);
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async meusBeneficiosPadrao(req: Request, res: Response) {
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

      const beneficios =
        await empresaService.listarMeusBeneficiosPadrao(id_empresa_real);

      return res.json({
        success: true,
        data: beneficios,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
