import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { EmpresaEntrevistaService } from "../services/EmpresaEntrevistaService.js";

const empresaEntrevistaService = new EmpresaEntrevistaService();

export class EmpresaEntrevistaController {
  async agendar(req: Request, res: Response) {
    try {
      const { id_candidatura } = req.params;
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

      // O middleware de rota já validou o body, mas garantimos a tipagem aqui
      const dadosAgendamento = req.body;

      const agendamento = await empresaEntrevistaService.agendarEntrevista(
        Number(id_candidatura),
        id_empresa_real,
        {
          ...dadosAgendamento,
          data_hora: new Date(dadosAgendamento.data_hora),
        },
      );

      return res.status(200).json({
        success: true,
        message:
          "Entrevista agendada com sucesso! O convite será enviado ao publicar as notificações.",
        data: agendamento,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
