import type { Request, Response } from "express"
import { prisma } from "../config/prisma.js";

export class TaxonomiaService {
  // --- GESTÃO DE BAIRROS ---
  async gerenciarBairros(
    acao: "LISTAR" | "CRIAR" | "DELETAR",
    dados?: { id?: number; nome?: string },
  ) {
    if (acao === "LISTAR") {
      return await prisma.bairro.findMany({ orderBy: { nome: "asc" } });
    }

    if (acao === "CRIAR" && dados?.nome) {
      return await prisma.bairro.create({ data: { nome: dados.nome } });
    }

    if (acao === "DELETAR" && dados?.id) {
      return await prisma.bairro.delete({
        where: { id_bairro: Number(dados.id) }, // Garantimos que passamos apenas o ID único
      });
    }
  }

  // --- GESTÃO DE ÁREAS DE ATUAÇÃO ---
  async gerenciarAreas(
    acao: "LISTAR" | "CRIAR" | "DELETAR",
    dados?: { id?: number; nome?: string },
  ) {
    if (acao === "LISTAR") {
      return await prisma.areaAtuacao.findMany({ orderBy: { nome: "asc" } });
    }

    if (acao === "CRIAR" && dados?.nome) {
      return await prisma.areaAtuacao.create({ data: { nome: dados.nome } });
    }

    if (acao === "DELETAR" && dados?.id) {
      return await prisma.areaAtuacao.delete({
        where: { id_area: Number(dados.id) },
      });
    }
  }

  // --- GESTÃO DE BENEFÍCIOS PADRÃO ---
  async gerenciarBeneficios(
    acao: "LISTAR" | "CRIAR" | "DELETAR",
    dados?: { id?: number; nome?: string },
  ) {
    if (acao === "LISTAR") {
      return await prisma.beneficio.findMany({ orderBy: { descricao: "asc" } });
    }

    if (acao === "CRIAR" && dados?.nome) {
      return await prisma.beneficio.create({ data: { descricao: dados.nome } });
    }

    if (acao === "DELETAR" && dados?.id) {
      return await prisma.beneficio.delete({
        where: { id_beneficio: Number(dados.id) },
      });
    }
  }
}
