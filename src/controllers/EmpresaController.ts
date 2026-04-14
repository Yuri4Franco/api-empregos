// EmpresaController.ts
import type { Request, Response } from "express";
import { EmpresaService } from "../services/EmpresaService.js";

const empresaService = new EmpresaService();

export class EmpresaController {
  async desbloquearCandidato(req: Request, res: Response) {
    try {
      const { id_candidato } = req.params;
      const user = req.user as any;

      if (user.role !== "EMPRESA") {
        return res
          .status(403)
          .json({ message: "Apenas empresas podem desbloquear currículos." });
      }

      const perfil = await empresaService.visualizarPerfilCandidato(
        user.id_empresa,
        Number(id_candidato),
      );

      return res.status(200).json({
        success: true,
        message: "Currículo desbloqueado com sucesso!",
        data: perfil,
      });
    } catch (error: any) {
      return res.status(402).json({
        // 402 Payment Required é elegante aqui
        success: false,
        error: error.message,
      });
    }
  }

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
      // O ID vem do token (empresa logada) para segurança
      const id_empresa = (req.user as any).id_empresa;

      if (!id_empresa) {
        return res
          .status(403)
          .json({ error: "Usuário não vinculado a uma empresa." });
      }

      const empresa = await empresaService.atualizarPerfilInstitucional(
        id_empresa,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso!",
        data: empresa,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
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
      const id_empresa = (req.user as any).id_empresa;

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum banner enviado." });
      }

      const bannerUrl = req.file.path;

      await empresaService.atualizarBannerEmpresa(id_empresa, bannerUrl);

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
      const id_empresa = (req.user as any).id_empresa;

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "Nenhum logotipo enviado." });
      }

      // A URL gerada com transformação 400x400 fica em req.file.path
      const logoUrl = req.file.path;

      await empresaService.atualizarLogoEmpresa(id_empresa, logoUrl);

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

      console.log("Buscando empresa para o usuário:", id_usuario);

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
}
