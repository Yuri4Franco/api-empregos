import type { Request, Response } from "express";
import { EmpresaDashboardService } from "../services/EmpresaDashboardService.js";
import { prisma } from "../config/prisma.js";

const dashboardService = new EmpresaDashboardService();

export class EmpresaDashboardController {
  async estatisticas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      // Busca qual é a empresa desse usuário logado
      const usuario = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true }
      });

      if (!usuario || !usuario.id_empresa) {
        return res.status(403).json({ 
          success: false, 
          error: "Acesso negado. Nenhuma empresa vinculada a este usuário." 
        });
      }

      const estatisticas = await dashboardService.obterEstatisticas(usuario.id_empresa);

      return res.status(200).json({
        success: true,
        data: estatisticas
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async resumoVagas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const usuario = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true }
      });

      if (!usuario || !usuario.id_empresa) {
        return res.status(403).json({ 
          success: false, 
          error: "Acesso negado. Nenhuma empresa vinculada a este usuário." 
        });
      }

      const resumo = await dashboardService.obterResumoVagas(usuario.id_empresa);

      return res.status(200).json({
        success: true,
        data: resumo
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async proximasEntrevistas(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const usuario = await prisma.usuario.findUnique({
        where: { id_usuario },
        select: { id_empresa: true }
      });

      if (!usuario || !usuario.id_empresa) {
        return res.status(403).json({ 
          success: false, 
          error: "Acesso negado. Nenhuma empresa vinculada a este usuário." 
        });
      }

      const entrevistas = await dashboardService.obterProximasEntrevistas(usuario.id_empresa);

      return res.status(200).json({
        success: true,
        data: entrevistas
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}