import type { Request, Response } from "express";
import { CandidatoService } from "../services/CandidatoService.js";
import { updateCandidatoSchema } from "../schemas/auth.schema.js";
import { prisma } from "../config/prisma.js";

const candidatoService = new CandidatoService();

export class CandidatoController {


  async meuCurriculo(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      console.log("ID do usuário autenticado:", id_usuario);

      if (!id_usuario) {
        return res
          .status(401)
          .json({ success: false, error: "Usuário não autenticado." });
      }

      const dadosCurriculo =
        await candidatoService.obterMeuCurriculo(id_usuario);

      return res.status(200).json({
        success: true,
        data: dadosCurriculo,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async actualizar(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;

      const candidatoActualizado = await candidatoService.actualizarDadosGerais(
        id_usuario,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso!",
        data: candidatoActualizado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async toggleVisibilidade(req: Request, res: Response) {
    try {
      const id_usuario = (req.user as any).id;
      
      // Converte explicitamente para booleano caso venha como string do front
      const perfil_visivel_empresas = Boolean(req.body.perfil_visivel_empresas);

      const resultado = await candidatoService.atualizarVisibilidade(
        id_usuario,
        perfil_visivel_empresas,
      );

      return res.status(200).json({
        success: true,
        message: perfil_visivel_empresas
          ? "Seu currículo agora está visível para as empresas."
          : "Seu currículo foi ocultado do banco de talentos.",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async uploadFoto(req: Request, res: Response) {
    try {
      console.log("Iniciando upload de foto de perfil...");
      const id_usuario = (req.user as any).id;

      console.log("ID do usuário autenticado para upload de foto:", id_usuario);
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Nenhuma imagem foi enviada.",
        });
      }

      const foto_url = req.file.path;
      console.log("URL da foto recebida:", foto_url);

      const resultado = await candidatoService.atualizarFotoPerfil(
        id_usuario,
        foto_url,
      );

      return res.status(200).json({
        success: true,
        message: "Foto de perfil atualizada com sucesso!",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
