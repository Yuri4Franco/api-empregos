import { prisma } from "../config/prisma.js";

export class CompetenciaService {
  async adicionar(id_usuario: number, dados: any) {
    // 1. REGRA DE NEGÓCIO: Checar o limite de 10 competências
    const totalCompetencias = await prisma.candidatoCompetencia.count({
      where: { id_candidato: id_usuario },
    });

    if (totalCompetencias >= 10) {
      throw new Error(
        "Você atingiu o limite máximo de 10 competências no seu currículo.",
      );
    }

    // 2. Verificar se o candidato já tem essa competência (para não duplicar)
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

    // 3. Adiciona a competência
    return await prisma.candidatoCompetencia.create({
      data: {
        id_candidato: id_usuario,
        id_competencia: dados.id_competencia,
        nivel: dados.nivel,
      },
      include: {
        competencia: true,
      },
    });
  }

  async deletar(id_usuario: number, id_competencia: number) {
    // Tenta deletar usando a chave composta (ID do Candidato + ID da Competência)
    try {
      return await prisma.candidatoCompetencia.delete({
        where: {
          id_candidato_id_competencia: {
            id_candidato: id_usuario,
            id_competencia: id_competencia,
          },
        },
      });
    } catch (error) {
      throw new Error("Competência não encontrada no seu currículo.");
    }
  }

  async sugerirOuVincularCompetencia(id_candidato: number, nome_sugerido: string, nivel: string) {
    // 1. Trim e Case Insensitive (Sanitização)
    // Transforma "  java   script " em "Java Script"
    const nomeSanitizado = nome_sugerido
      .trim()
      .replace(/\s+/g, ' ') // Remove espaços duplos
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (nomeSanitizado.length < 2) {
      throw new Error("O nome da habilidade é muito curto.");
    }

    // 2. Busca de Duplicidade Inteligente (PostgreSQL + Prisma)
    const competenciaExistente = await prisma.competencia.findFirst({
      where: {
        nome: {
          equals: nomeSanitizado,
          mode: 'insensitive' // Ignora maiúsculas e minúsculas na busca!
        }
      }
    });

    let idCompetenciaAlvo: number;
    let competenciaRetorno;

    // 3. Avalia o Status se ela já existir
    if (competenciaExistente) {
      if (competenciaExistente.status === "REJEITADA") {
        throw new Error("Esta habilidade não é aceita em nossa plataforma.");
      }
      // Se for APROVADA ou PENDENTE, nós reaproveitamos
      idCompetenciaAlvo = competenciaExistente.id_competencia;
      competenciaRetorno = competenciaExistente;
    } else {
      // 4. Se não existir nada parecido, cria a nova sugestão como PENDENTE
      const novaCompetencia = await prisma.competencia.create({
        data: {
          nome: nomeSanitizado,
          status: "PENDENTE"
        }
      });
      idCompetenciaAlvo = novaCompetencia.id_competencia;
      competenciaRetorno = novaCompetencia;
    }

    // 5. Verifica se o candidato já não tem essa competência vinculada ao currículo
    const jaVinculado = await prisma.candidatoCompetencia.findUnique({
      where: {
        id_candidato_id_competencia: {
          id_candidato,
          id_competencia: idCompetenciaAlvo
        }
      }
    });

    if (jaVinculado) {
      throw new Error("Você já possui esta habilidade cadastrada em seu currículo.");
    }

    // 6. Finalmente, vincula a competência ao candidato
    await prisma.candidatoCompetencia.create({
      data: {
        id_candidato,
        id_competencia: idCompetenciaAlvo,
        nivel: nivel as any
      }
    });

    // Retorna a competência para o front-end conseguir renderizar a "tag" na tela na hora
    return {
      id_competencia: idCompetenciaAlvo,
      nome: competenciaRetorno.nome,
      nivel: nivel,
      status: competenciaRetorno.status
    };
  }
}
