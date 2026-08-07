import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { StatusCandidatura } from "@prisma/client";
import { calcularPontuacaoCandidato } from "../utils/candidato.js";

export class CandidatoService {
  async inscrever(
    id_usuario: number,
    id_vaga: number,
    respostas: { id_pergunta: number; resposta: string }[],
  ) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    const candidatoAtualizado = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (dadosCandidato.cpf) {
          const candidatoExistente = await tx.candidato.findUnique({
            where: { cpf: dadosCandidato.cpf },
            select: { id_usuario: true },
          });

          if (
            candidatoExistente &&
            candidatoExistente.id_usuario !== id_usuario
          ) {
            throw new Error(
              "Este CPF já está cadastrado em outra conta. Por favor, acesse sua conta original ou entre em contato com a ACI-Panambi para suporte.",
            );
          }
        }

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
      },
    );
    
    const novaNota =
      await this.atualizarPorcentagemCurriculo(id_usuario);

    return {
      candidato: candidatoAtualizado,
      porcentagem_curriculo: novaNota,
    };
  }

  async atualizarVisibilidade(id_usuario: number, visivel: boolean) {
    // 1. TRAVA DE SEGURANÇA: Se ele quer ficar visível, precisamos checar o CPF
    if (visivel) {
      const candidato = await prisma.candidato.findUnique({
        where: { id_usuario },
        select: { cpf: true },
      });

      if (!candidato) {
        throw new Error("Candidato não encontrado.");
      }

      // Se o CPF for null ou string vazia, barra a ação!
      if (!candidato.cpf) {
        throw new Error(
          "Para deixar seu currículo visível no banco de talentos, é obrigatório cadastrar seu CPF na aba em Dados Básicos.",
        );
      }
    }

    // 2. Se passou na validação (ou se ele só quer ocultar), atualiza no banco
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

  async atualizarPrimeiroEmprego(
    id_candidato: number,
    primeiro_emprego: boolean,
  ) {
    const togglePrimeiroEmprego = await prisma.candidato.update({
      where: { id_usuario: id_candidato },
      data: { primeiro_emprego },
      select: { primeiro_emprego: true }, 
    });

    const novaNota = await this.atualizarPorcentagemCurriculo(id_candidato);

    return {
      primeiro_emprego: togglePrimeiroEmprego,
      porcentagem_curriculo: novaNota,
    };
  }

  

  async listarMeusAgendamentos(id_usuario: number) {
    // 🕒 Lógica para pegar o início do dia atual (00:00:00)
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const agendamentos = await prisma.agendamentoEntrevista.findMany({
      where: {
        // 🔥 FILTRO: Mostra agendamentos de HOJE (desde as 00:00) em diante
        data_hora: {
          gte: inicioDoDia,
        },

        // Busca os agendamentos que pertencem às candidaturas deste usuário
        candidatura: {
          id_candidato: id_usuario,
          // Filtro de Limpeza: Ignora se o processo já acabou para ele
          status_atual: {
            notIn: ["DESISTENCIA", "REPROVADO"],
          },
        },
      },
      // Ordena pela data: As entrevistas mais próximas do dia de hoje aparecem primeiro
      orderBy: {
        data_hora: "asc",
      },
      include: {
        candidatura: {
          select: {
            id_candidatura: true,
            status_atual: true,
            vaga: {
              select: {
                titulo: true,
                empresa_confidencial: true,
                empresa: {
                  select: { nome_fantasia: true, logotipo_url: true },
                },
              },
            },
          },
        },
      },
    });

    return agendamentos.map((ag) => {
      const isConfidencial = ag.candidatura.vaga.empresa_confidencial;

      return {
        id_agendamento: ag.id_agendamento,
        id_candidatura: ag.candidatura.id_candidatura,
        data_hora: ag.data_hora,
        local_link: ag.local_link,
        observacoes: ag.observacoes,
        vaga_titulo: ag.candidatura.vaga.titulo,
        empresa_nome: isConfidencial
          ? "Empresa Confidencial"
          : ag.candidatura.vaga.empresa.nome_fantasia,
        empresa_logo: isConfidencial
          ? null
          : ag.candidatura.vaga.empresa.logotipo_url,
        status_candidatura: ag.candidatura.status_atual,
      };
    });
  }

  async atualizarPorcentagemCurriculo(id_usuario: number) {
    const candidato = await prisma.candidato.findUnique({
      where: { id_usuario },
      select: {
        cpf: true,
        whatsapp: true,
        data_nascimento: true,
        resumo_profissional: true,
        objetivo_profissional: true,
        primeiro_emprego: true,
        endereco: {
          select: {
            cep: true,
            logradouro: true,
            numero: true,
            bairro: true,
            cidade: true,
            uf: true,
          },
        },
        areas_atuacao: { select: { id_area: true }, take: 1 },
        experiencias: { select: { id_experiencia: true }, take: 1 },
        formacoes: { select: { id_formacao: true }, take: 1 },
        competencias: { select: { id_competencia: true }, take: 1 },
      },
    });

    if (!candidato) return null;

    const novaPontuacao = calcularPontuacaoCandidato(candidato);

    await prisma.candidato.update({
      where: { id_usuario },
      data: { porcentagem_curriculo: novaPontuacao },
    });

    return novaPontuacao;
  }
}
