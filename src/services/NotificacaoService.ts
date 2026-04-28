import { prisma } from "../config/prisma.js";

interface NovaNotificacaoDTO {
  id_usuario: number;
  titulo: string;
  mensagem: string;
  tipo?: "SUCESSO" | "ALERTA" | "INFO";
  link_acao?: string | null;
}

export class NotificacaoService {

    async enviar(dados: NovaNotificacaoDTO) {
    const notificacao = await prisma.notificacao.create({
      data: {
        id_usuario: dados.id_usuario,
        titulo: dados.titulo,
        mensagem: dados.mensagem,
        tipo: dados.tipo || "INFO",
        link_acao: dados.link_acao || null,
      }
    });
    
    return notificacao;
  }

    
  async contarNaoLidas(id_usuario: number) {
    const total = await prisma.notificacao.count({
      where: {
        id_usuario: id_usuario,
        lida: false,
      },
    });

    return total;
  }

  async listarNotificacoes(id_usuario: number) {
    return await prisma.notificacao.findMany({
      where: { id_usuario },
      take: 20,
      orderBy: {
        criado_em: "desc", // As mais novas no topo do Drawer
      },
    });
  }

  async marcarTodasComoLidas(id_usuario: number) {
    return await prisma.notificacao.updateMany({
      where: {
        id_usuario: id_usuario,
        lida: false,
      },
      data: {
        lida: true,
      },
    });
  }

}