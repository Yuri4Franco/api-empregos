import { prisma } from "../config/prisma.js";
import { StatusCandidatura } from "@prisma/client";

export class CandidatoService {

  async inscrever(
    id_usuario: number,
    id_vaga: number,
    respostas: { id_pergunta: number; resposta: string }[],
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Validar se a vaga existe e está ativa
      const vaga = await tx.vaga.findUnique({
        where: { id_vaga },
        include: {
          perguntas_eliminatorias: true,
          etapas: { where: { tipo: "INICIAL" } },
        },
      });

      if (!vaga || vaga.status !== "ATIVA") {
        throw new Error(
          "Esta vaga não está recebendo candidaturas no momento.",
        );
      }

      // 2. Verificar se o candidato já se inscreveu
      const jaInscrito = await tx.candidatura.findFirst({
        where: { id_vaga, id_candidato: id_usuario },
      });

      if (jaInscrito) throw new Error("Você já se candidatou a esta vaga.");

      // 3. Identificar a Etapa Inicial do Kanban
      const etapaInicial = vaga.etapas[0];
      if (!etapaInicial)
        throw new Error(
          "A vaga ainda não foi configurada corretamente pela empresa.",
        );

      // 4. Criar a Candidatura
      const candidatura = await tx.candidatura.create({
        data: {
          id_vaga,
          id_candidato: id_usuario,
          id_etapa_atual: etapaInicial.id_etapa,
          status_atual: "INSCRITO",
        },
      });

      // 5. Processar e Salvar Respostas com Triagem Automática
      if (respostas.length > 0) {
        const dadosRespostas = respostas.map((resp) => {
          const configVaga = vaga.perguntas_eliminatorias.find(
            (p) => p.id_pergunta === resp.id_pergunta,
          );

          // Regra de Triagem: Se a resposta for diferente da esperada, marca como fora do perfil
          const isForaDoPerfil = configVaga
            ? resp.resposta.toLowerCase() !==
              configVaga.resposta_esperada.toLowerCase()
            : false;

          return {
            id_candidatura: candidatura.id_candidatura,
            id_pergunta: resp.id_pergunta,
            resposta: resp.resposta,
            fora_do_perfil: isForaDoPerfil,
          };
        });

        await tx.respostaPergunta.createMany({
          data: dadosRespostas,
        });
      }

      return candidatura;
    });
  }

  async obterMeuCurriculo(id_usuario: number) {
    const curriculo = await prisma.candidato.findUnique({
      where: {
        id_usuario: id_usuario,
      },
      include: {
        // Traz o Nome e E-mail da tabela Usuario (PK)
        usuario: {
          select: {
            nome: true,
            email: true,
            status: true,
            criado_em: true,
          },
        },
        // Traz Endereço e Área de Atuação
        endereco: true,
        areas_atuacao: {
          include: { area: { select: { nome: true } } },
        },

        // Traz as Experiências ordenadas por data_inicio decrescente (mais recentes primeiro)
        experiencias: {
          orderBy: {
            data_inicio: "desc",
          },
        },

        // Traz as Formações ordenadas por data_conclusao decrescente
        formacoes: {
          orderBy: {
            data_conclusao: "desc",
          },
        },

        // Traz as Competências e inclui os dados da tabela Competencia (ex: nome da skill)
        competencias: {
          include: {
            competencia: true,
          },
        },
      },
    });

    if (!curriculo) {
      throw new Error("Currículo não encontrado para este usuário.");
    }

    return curriculo;
  }

  async actualizarDadosGerais(id_usuario: number, dados: any) {
    const { endereco, ...dadosCandidato } = dados;
    console.log("Dados recebidos para atualização:", dados);

    return await prisma.$transaction(async (tx) => {
      return await tx.candidato.update({
        where: { id_usuario },
        data: {
          ...dadosCandidato,

          ...(endereco && {
            endereco: {
              upsert: {
                create: endereco,
                update: endereco,
              },
            },
          }),
        },
        include: {
          endereco: true,
          areas_atuacao: {
            include: { area: { select: { nome: true } } },
          },
        },
      });
    });
  }

  async atualizarVisibilidade(id_usuario: number, visivel: boolean) {
    return await prisma.candidato.update({
      where: { id_usuario },
      data: {
        perfil_visivel_empresas: visivel,
      },
      select: {
        perfil_visivel_empresas: true,
      },
    });
  }

  async atualizarFotoPerfil(id_usuario: number, foto_url: string) {
    return await prisma.candidato.update({
      where: {
        id_usuario: id_usuario,
      },
      data: {
        foto_url: foto_url,
      },
      // No select, podemos inclusive trazer o nome que está na tabela Usuario
      // para que o Front-end receba o objeto completo do perfil
      select: {
        id_usuario: true,
        foto_url: true,
        usuario: {
          select: {
            nome: true,
          },
        },
      },
    });
  }
}
