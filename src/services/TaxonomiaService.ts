import { prisma } from "../config/prisma.js";

export class TaxonomiaService {
  // --- GESTÃO DE ÁREAS DE ATUAÇÃO ---
  async gerenciarAreas(
    acao: "LISTAR" | "CRIAR" | "EDITAR" | "DELETAR",
    dados?: { id?: number; nome?: string },
  ) {
    if (acao === "LISTAR") {
      return await prisma.areaAtuacao.findMany({ orderBy: { nome: "asc" } });
    }

    if (acao === "CRIAR" && dados?.nome) {
      return await prisma.areaAtuacao.create({ data: { nome: dados.nome } });
    }

    if (acao === "EDITAR" && dados?.id && dados?.nome) {
      return await prisma.areaAtuacao.update({
        where: { id_area: Number(dados.id) },
        data: { nome: dados.nome },
      });
    }

    if (acao === "DELETAR" && dados?.id) {
      return await prisma.areaAtuacao.delete({
        where: { id_area: Number(dados.id) },
      });
    }
  }

  // --- GESTÃO DE BENEFÍCIOS PADRÃO ---
  async gerenciarBeneficios(
    acao: "LISTAR" | "CRIAR" | "EDITAR" | "DELETAR",
    dados?: { id?: number; descricao?: string },
  ) {
    if (acao === "LISTAR") {
      return await prisma.beneficio.findMany({ orderBy: { descricao: "asc" } });
    }

    if (acao === "CRIAR" && dados?.descricao) {
      return await prisma.beneficio.create({ data: { descricao: dados.descricao } });
    }

    if (acao === "EDITAR" && dados?.id && dados?.descricao) {
      return await prisma.beneficio.update({
        where: { id_beneficio: Number(dados.id) },
        data: { descricao: dados.descricao },
      });
    }

    

    if (acao === "DELETAR" && dados?.id) {
      return await prisma.beneficio.delete({
        where: { id_beneficio: Number(dados.id) },
      });
    }
  }

  async listarPerguntasEliminatorias() {
    // Busca perguntas que são marcadas como padrão do sistema ou cadastradas
    return await prisma.perguntaEliminatoria.findMany({
      orderBy: {
        descricao: "asc",
      },
    });
  }

  async listarCompetencias() {
    return await prisma.competencia.findMany({
      where: {
        status: "APROVADA",
      },
      orderBy: {
        nome: "asc",
      },
    });
  }
}
