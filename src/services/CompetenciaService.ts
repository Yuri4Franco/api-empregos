import { prisma } from "../config/prisma.js";
import { CandidatoService } from "./CandidatoService.js";

const candidatoService = new CandidatoService();

export class CompetenciaService {
  async adicionar(id_usuario: number, dados: any) {
    const totalCompetencias = await prisma.candidatoCompetencia.count({
      where: { id_candidato: id_usuario },
    });

    if (totalCompetencias >= 10) {
      throw new Error(  
        "Você atingiu o limite máximo de 10 competências no seu currículo.",
      );
    }

    const competenciaExistente = await prisma.candidatoCompetencia.findUnique({
      where: {
        id_candidato_id_competencia: {
          id_candidato: id_usuario,
          id_competencia: dados.id_competencia,
        },
      },
    });

    if (competenciaExistente) {
      throw new Error("Você já adicionou esta competência ao seu currículo.");
    }

    const competenciaAdicionada = await prisma.candidatoCompetencia.create({
      data: {
        id_candidato: id_usuario,
        id_competencia: dados.id_competencia,
        nivel: dados.nivel,
      },
      include: {
        competencia: true,
      },
    });

    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    return {
      competencia: competenciaAdicionada,
      porcentagem_curriculo: novaNota,
    };
  }

  async deletar(id_usuario: number, id_competencia: number) {
    try {
      const competenciaDeletada = await prisma.candidatoCompetencia.delete({
        where: {
          id_candidato_id_competencia: {
            id_candidato: id_usuario,
            id_competencia: id_competencia,
          },
        },
      });

      const novaNota =
        await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

      return {
        competencia: competenciaDeletada,
        porcentagem_curriculo: novaNota,
      };
    } catch (error) {
      throw new Error("Competência não encontrada no seu currículo.");
    }
  }

  async sugerirOuVincularCompetencia(
    id_candidato: number,
    nome_sugerido: string,
    nivel: string,
  ) {
    // 1. Trim e Case Insensitive (Sanitização)
    const nomeSanitizado = nome_sugerido
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    if (nomeSanitizado.length < 2) {
      throw new Error("O nome da habilidade é muito curto.");
    }

    // 2. Busca de Duplicidade Inteligente (PostgreSQL + Prisma)
    const competenciaExistente = await prisma.competencia.findFirst({
      where: {
        nome: {
          equals: nomeSanitizado,
          mode: "insensitive",
        },
      },
    });

    let idCompetenciaAlvo: number;

    // 3. Avalia o Status se ela já existir
    if (competenciaExistente) {
      if (competenciaExistente.status === "REJEITADA") {
        throw new Error("Esta habilidade não é aceita em nossa plataforma.");
      }
      // Se for APROVADA ou PENDENTE, nós reaproveitamos
      idCompetenciaAlvo = competenciaExistente.id_competencia;
    } else {
      // 4. Se não existir nada parecido, cria a nova sugestão como PENDENTE
      const novaCompetencia = await prisma.competencia.create({
        data: {
          nome: nomeSanitizado,
          status: "PENDENTE",
        },
      });
      idCompetenciaAlvo = novaCompetencia.id_competencia;
    }

    // 5. Verifica se o candidato já não tem essa competência vinculada ao currículo
    const jaVinculado = await prisma.candidatoCompetencia.findUnique({
      where: {
        id_candidato_id_competencia: {
          id_candidato,
          id_competencia: idCompetenciaAlvo,
        },
      },
    });

    if (jaVinculado) {
      throw new Error(
        "Você já possui esta habilidade cadastrada em seu currículo.",
      );
    }

    // ✨ 6. Finalmente, vincula a competência ao candidato e PEDE O JOIN DO PRISMA
    const competenciaSugerida = await prisma.candidatoCompetencia.create({
      data: {
        id_candidato,
        id_competencia: idCompetenciaAlvo,
        nivel: nivel as any,
      },
      include: {
        competencia: true, // <-- Isso faz o Prisma trazer o nome e o status junto!
      },
    });

    // 7. Gatilho da nota
    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_candidato);

    // 8. Retorno perfeito para o front-end
    return {
      competencia: competenciaSugerida,
      porcentagem_curriculo: novaNota,
    };
  }
}
