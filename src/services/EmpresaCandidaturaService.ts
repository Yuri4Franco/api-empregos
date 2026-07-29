import type { Prisma, StatusCandidatura } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { NotificacaoService } from "./NotificacaoService.js";
import { EmailService } from "./EmailService.js";

export class EmpresaCandidaturaService {
  private notificacaoService = new NotificacaoService();
  private emailService = new EmailService();

  // ==========================================
  // GETS DO PAINEL E PERFIL
  // ==========================================

  // ==========================================
  // Painel de Gestão de Candidaturas
  // ==========================================
  async obterPainelGestao(id_vaga: number, id_empresa: number) {
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      include: {
        etapas: { orderBy: { ordem: "asc" } },
      },
    });

    if (!vaga) throw new Error("Vaga não encontrada.");

    const candidaturas = await prisma.candidatura.findMany({
      where: { id_vaga },
      include: {
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true } },
            areas_atuacao: true,
          },
        },
        respostas: true,
        agendamento: true,
        avaliacao: true,
      },
    });

    return {
      vaga: { titulo: vaga.titulo, status: vaga.status },
      colunas: vaga.etapas.map((etapa) => ({
        id_etapa: etapa.id_etapa,
        nome_etapa: etapa.nome_etapa,
        ordem: etapa.ordem,
        tipo: etapa.tipo,
        requer_agendamento: etapa.requer_agendamento,
        candidatos: candidaturas
          .filter((c) => c.id_etapa_atual === etapa.id_etapa)
          .map((c) => ({
            id_candidatura: c.id_candidatura,
            nome: c.candidato.usuario.nome,
            id_usuario: c.id_candidato,
            fora_do_perfil: c.respostas.some((r) => r.fora_do_perfil),
            data_inscricao: c.data_candidatura,
            possui_agendamento: !!c.agendamento,
            visualizada: c.visualizada || false,
            data_entrevista: c.agendamento?.data_hora || null,
            avaliacao_nota: c.avaliacao?.pontuacao || null,
            whatsapp: c.candidato.whatsapp || null,
            status: c.status_atual,
          })),
      })),
    };
  }

  // ==========================================
  // Perfil do Candidato
  // ==========================================
  async obterPerfilCompleto(id_candidatura: number, id_empresa: number) {
    const candidatura = await prisma.candidatura.findUnique({
      where: { id_candidatura },
      include: {
        vaga: { include: { configuracao: true } },
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true } },
            endereco: true,
            areas_atuacao: true,
            experiencias: { orderBy: { data_inicio: "desc" } },
            formacoes: { orderBy: { data_conclusao: "desc" } },
            competencias: { include: { competencia: true } },
          },
        },
        respostas: true,
        agendamento: true,
        avaliacao: true,
      },
    });

    if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
      throw new Error("Acesso negado.");
    }

    if (!candidatura.visualizada) {
      const agora = new Date();
      await prisma.candidatura.update({
        where: { id_candidatura },
        data: { visualizada: true, data_visualizacao: agora },
      });
      candidatura.visualizada = true;
      candidatura.data_visualizacao = agora;
    }

    const camposEscolhidos = (candidatura.vaga.configuracao
      ?.campos_destaque as string[]) || [
      "nome",
      "experiencia_recente",
      "cidade",
    ];
    const resumo: any = {};

    if (camposEscolhidos.includes("experiencia_recente")) {
      resumo.experiencia_recente =
        candidatura.candidato.experiencias[0] || "Sem experiência registrada";
    }

    if (
      camposEscolhidos.includes("idade") &&
      candidatura.candidato.data_nascimento
    ) {
      const hoje = new Date();
      const nasc = new Date(candidatura.candidato.data_nascimento);
      let idade = hoje.getFullYear() - nasc.getFullYear();
      resumo.idade = idade;
    }

    if (camposEscolhidos.includes("localizacao")) {
      resumo.cidade_bairro = `${candidatura.candidato.endereco?.cidade} - ${candidatura.candidato.endereco?.bairro}`;
    }

    return { ...candidatura, resumo_estrategico: resumo };
  }

  // ==========================================
  // Histórico do Candidato(timeline)
  // ==========================================
  async obterHistoricoCandidatura(id_candidatura: number, id_empresa: number) {
    const candidatura = await prisma.candidatura.findFirst({
      where: { id_candidatura, vaga: { id_empresa } },
      include: {
        movimentacoes: true,
        agendamento: true,
        avaliacao: true,
      },
    });

    if (!candidatura)
      throw new Error("Candidatura não encontrada ou acesso negado.");

    const eventos = [];

    eventos.push({
      id_evento: `insc_${candidatura.id_candidatura}`,
      tipo: "INSCRICAO",
      titulo: "Candidatura Recebida",
      descricao: "O candidato enviou o currículo para esta vaga.",
      data_hora: candidatura.data_candidatura,
    });

    if (candidatura.visualizada && candidatura.data_visualizacao) {
      eventos.push({
        id_evento: `view_${candidatura.id_candidatura}`,
        tipo: "VISUALIZACAO",
        titulo: "Currículo Visualizado",
        descricao: "Você abriu o perfil do candidato pela primeira vez.",
        data_hora: candidatura.data_visualizacao,
      });
    }

    candidatura.movimentacoes.forEach((mov) => {
      eventos.push({
        id_evento: `mov_${mov.id_movimento}`,
        tipo: "MOVIMENTACAO",
        titulo: "Avanço de Etapa",
        descricao: `Candidato avançou para: ${mov.status_destino}.`,
        data_hora: mov.criado_em,
      });
    });

    if (candidatura.avaliacao) {
      eventos.push({
        id_evento: `aval_${candidatura.avaliacao.id_avaliacao}`,
        tipo: "AVALIACAO",
        titulo: "Candidato Avaliado",
        descricao: `Recebeu ${candidatura.avaliacao.pontuacao || "nota"} estrelas.`,
        data_hora: candidatura.avaliacao.criado_em,
      });
    }

    if (candidatura.agendamento) {
      eventos.push({
        id_evento: `agen_${candidatura.agendamento.id_agendamento}`,
        tipo: "AGENDAMENTO",
        titulo: "Entrevista Agendada",
        descricao: `Marcada para ${new Date(candidatura.agendamento.data_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        data_hora: candidatura.agendamento.criado_em,
      });
    }

    eventos.sort(
      (a, b) =>
        new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime(),
    );
    return eventos;
  }

  // ==========================================
  // AÇÕES
  // ==========================================

  // ==========================================
  // Configuração de Campos em Destaque
  // ==========================================
  async atualizarPreferenciaDestaque(
    id_vaga: number,
    id_empresa: number,
    campos: string[],
  ) {
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
    });
    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");

    return await prisma.configuracaoVaga.upsert({
      where: { id_vaga },
      update: { campos_destaque: campos },
      create: { id_vaga, campos_destaque: campos },
    });
  }

  // ==========================================
  // Avançar Candidato (Individual)
  // ==========================================
  async avancarCandidato(id_candidatura: number, id_empresa: number) {
    // ✨ 1. Consulta corrigida: busca nome e email dentro da relação 'usuario'
    const candidatura = await prisma.candidatura.findUnique({
      where: { id_candidatura },
      include: {
        candidato: {
          select: {
            usuario: { select: { nome: true, email: true } },
          },
        },
        vaga: {
          select: {
            id_empresa: true,
            titulo: true,
            empresa: { select: { nome_fantasia: true } },
          },
        },
      },
    });

    if (!candidatura || candidatura.vaga.id_empresa !== id_empresa) {
      throw new Error("Candidatura não encontrada ou acesso negado.");
    }

    const etapaAtual = await prisma.etapaProcesso.findUnique({
      where: { id_etapa: candidatura.id_etapa_atual },
    });

    if (!etapaAtual) throw new Error("Etapa atual não encontrada no sistema.");

    const proximaEtapa = await prisma.etapaProcesso.findFirst({
      where: { id_vaga: candidatura.id_vaga, ordem: { gt: etapaAtual.ordem } },
      orderBy: { ordem: "asc" },
    });

    if (!proximaEtapa) {
      throw new Error("Este candidato já está na última etapa do processo.");
    }

    let novoStatus: StatusCandidatura = "TRIAGEM";
    if (proximaEtapa.tipo === "FINAL") novoStatus = "APROVADO";
    if (proximaEtapa.nome_etapa.toLowerCase().includes("entrevista"))
      novoStatus = "ENTREVISTA";

    const resultado = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.movimentoCandidatura.create({
          data: {
            id_candidatura,
            etapa_origem: candidatura.id_etapa_atual,
            etapa_destino: proximaEtapa.id_etapa,
            status_destino: novoStatus,
            motivo: `Avançou para a etapa: ${proximaEtapa.nome_etapa}`,
            notificacao_pendente: false,
          },
        });

        return await tx.candidatura.update({
          where: { id_candidatura },
          data: {
            id_etapa_atual: proximaEtapa.id_etapa,
            status_atual: novoStatus,
          },
        });
      },
    );

    // ✨ Disparo IMEDIATO em Background
    if (!proximaEtapa.requer_agendamento) {
      // Acessando os dados corretamente pelo 'usuario'
      const nomeCandidato = candidatura.candidato.usuario.nome;
      const emailCandidato = candidatura.candidato.usuario.email;
      const tituloVaga = candidatura.vaga.titulo;
      const nomeEmpresa = candidatura.vaga.empresa?.nome_fantasia || "Empresa";

      // A) Notificação Push Interna (tipagem err: any corrigida)
      this.notificacaoService
        .enviar({
          id_usuario: candidatura.id_candidato,
          titulo:
            novoStatus === "APROVADO"
              ? "Parabéns, você foi APROVADO! 🏆"
              : "Parabéns, você avançou de etapa! 🎉",
          mensagem:
            novoStatus === "APROVADO"
              ? `Você foi selecionado na vaga "${tituloVaga}". A empresa entrará em contato em breve.`
              : `Sua candidatura para a vaga "${tituloVaga}" avançou para a etapa: ${proximaEtapa.nome_etapa}. Fique de olho nos seus contatos!`,
          tipo: "INFO",
          link_acao: `/candidato/minhas-candidaturas`,
        })
        .catch((err: any) =>
          console.error("Erro ao enviar notificação de avanço:", err),
        );

      // B) E-mail Inteligente (tipagem err: any corrigida)
      if (novoStatus === "APROVADO") {
        this.emailService
          .enviarEmailAprovacao(
            emailCandidato,
            nomeCandidato,
            tituloVaga,
            nomeEmpresa,
          )
          .catch((err: any) =>
            console.error("Erro ao enviar e-mail de aprovação:", err),
          );
      } else {
        this.emailService
          .enviarEmailAvanço(
            emailCandidato,
            nomeCandidato,
            tituloVaga,
            nomeEmpresa,
            proximaEtapa.nome_etapa,
          )
          .catch((err: any) =>
            console.error("Erro ao enviar e-mail de avanço:", err),
          );
      }
    }

    return resultado;
  }

  // ==========================================
  // Avançar em Massa (Lote)
  // ==========================================
  async avancarEmMassa(id_candidaturas: number[], id_empresa: number) {
    // ✨ Consulta corrigida: buscando a relação 'usuario' no select do candidato
    const candidaturas = await prisma.candidatura.findMany({
      where: {
        id_candidatura: { in: id_candidaturas },
        vaga: { id_empresa },
        status_atual: { notIn: ["REPROVADO", "DESISTENCIA"] },
      },
      select: {
        id_candidatura: true,
        id_etapa_atual: true,
        id_vaga: true,
        id_candidato: true,
        candidato: {
          select: {
            usuario: { select: { nome: true, email: true } },
          },
        },
      },
    });

    if (candidaturas.length === 0) return { sucesso: true, avancados: 0 };

    const idVaga = candidaturas[0]!.id_vaga;
    const todasMesmaVaga = candidaturas.every((c) => c.id_vaga === idVaga);
    if (!todasMesmaVaga)
      throw new Error(
        "Para avançar em massa, selecione candidatos de uma única vaga.",
      );

    const vagaDados = await prisma.vaga.findUnique({
      where: { id_vaga: idVaga },
      select: {
        titulo: true,
        empresa: { select: { nome_fantasia: true } },
      },
    });
    const nomeEmpresa = vagaDados?.empresa?.nome_fantasia || "Empresa";
    const tituloVaga = vagaDados?.titulo || "Vaga";

    const etapasVaga = await prisma.etapaProcesso.findMany({
      where: { id_vaga: idVaga },
      orderBy: { ordem: "asc" },
    });

    const movimentosParaCriar = [];
    const candidaturasParaAtualizar = [];
    const tarefasAssincronas: any[] = [];

    for (const c of candidaturas) {
      const etapaAtual = etapasVaga.find(
        (e) => e.id_etapa === c.id_etapa_atual,
      );
      if (!etapaAtual) continue;

      const proximaEtapa = etapasVaga.find((e) => e.ordem > etapaAtual.ordem);
      if (!proximaEtapa) continue;

      let novoStatus: StatusCandidatura = "TRIAGEM";
      if (proximaEtapa.tipo === "FINAL") novoStatus = "APROVADO";
      if (proximaEtapa.nome_etapa.toLowerCase().includes("entrevista"))
        novoStatus = "ENTREVISTA";

      movimentosParaCriar.push({
        id_candidatura: c.id_candidatura,
        etapa_origem: c.id_etapa_atual,
        etapa_destino: proximaEtapa.id_etapa,
        status_destino: novoStatus,
        motivo: `Avançado em massa para a etapa: ${proximaEtapa.nome_etapa}`,
        notificacao_pendente: false,
      });

      candidaturasParaAtualizar.push(
        prisma.candidatura.update({
          where: { id_candidatura: c.id_candidatura },
          data: {
            id_etapa_atual: proximaEtapa.id_etapa,
            status_atual: novoStatus,
          },
        }),
      );

      // ✨ Disparo assíncrono para cada candidato com caminhos e tipagens corrigidos
      if (!proximaEtapa.requer_agendamento) {
        const nomeCandidato = c.candidato.usuario.nome;
        const emailCandidato = c.candidato.usuario.email;

        // A) Notificação Push Interna
        tarefasAssincronas.push(
          this.notificacaoService
            .enviar({
              id_usuario: c.id_candidato,
              titulo:
                novoStatus === "APROVADO"
                  ? "Sua candidatura foi APROVADA! 🏆"
                  : "Sua candidatura avançou! 🎉",
              mensagem:
                novoStatus === "APROVADO"
                  ? `Você foi aprovado na vaga "${tituloVaga}". A empresa entrará em contato em breve.`
                  : `Ótimas notícias! Você avançou para a etapa "${proximaEtapa.nome_etapa}" na vaga ${tituloVaga}.`,
              tipo: "INFO",
              link_acao: `/candidato/minhas-candidaturas`,
            })
            .catch((err: any) =>
              console.error("Erro na notificação em massa:", err),
            ),
        );

        // B) E-mail Inteligente
        if (novoStatus === "APROVADO") {
          tarefasAssincronas.push(
            this.emailService
              .enviarEmailAprovacao(
                emailCandidato,
                nomeCandidato,
                tituloVaga,
                nomeEmpresa,
              )
              .catch((err: any) =>
                console.error("Erro no e-mail de aprovação em massa:", err),
              ),
          );
        } else {
          tarefasAssincronas.push(
            this.emailService
              .enviarEmailAvanço(
                emailCandidato,
                nomeCandidato,
                tituloVaga,
                nomeEmpresa,
                proximaEtapa.nome_etapa,
              )
              .catch((err: any) =>
                console.error("Erro no e-mail de avanço em massa:", err),
              ),
          );
        }
      }
    }

    if (movimentosParaCriar.length > 0) {
      await prisma.$transaction([
        prisma.movimentoCandidatura.createMany({ data: movimentosParaCriar }),
        ...candidaturasParaAtualizar,
      ]);

      Promise.all(tarefasAssincronas);
    }

    return {
      sucesso: true,
      avancados: movimentosParaCriar.length,
      ignorados: candidaturas.length - movimentosParaCriar.length,
    };
  }

  // ==========================================
  // Reprovar em Massa ou apenas 1
  // ==========================================
  async reprovarEmMassa(id_candidaturas: any[], id_empresa: number) {
    const idsNumericos = id_candidaturas.map((id) => Number(id));

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const candidaturasValidas = await tx.candidatura.findMany({
        where: {
          id_candidatura: { in: idsNumericos },
          vaga: { id_empresa },
          status_atual: { notIn: ["REPROVADO", "DESISTENCIA"] },
        },
        select: { id_candidatura: true, id_etapa_atual: true },
      });

      if (candidaturasValidas.length === 0) {
        throw new Error(
          "Nenhuma candidatura selecionada é válida para reprovação.",
        );
      }

      const idsFiltrados = candidaturasValidas.map((c) => c.id_candidatura);

      await tx.movimentoCandidatura.createMany({
        data: candidaturasValidas.map((c) => ({
          id_candidatura: c.id_candidatura,
          etapa_origem: c.id_etapa_atual,
          etapa_destino: c.id_etapa_atual,
          status_destino: "REPROVADO",
          motivo:
            "A empresa optou por não seguir com sua candidatura nesta oportunidade.",
          notificacao_pendente: false,
        })),
      });

      return await tx.candidatura.updateMany({
        where: { id_candidatura: { in: idsFiltrados } },
        data: { status_atual: "REPROVADO" },
      });
    });
  }

  // ==========================================
  // Avaliar Candidatura
  // ==========================================
  async avaliarCandidatura(
    id_candidatura: number,
    id_empresa: number,
    dados: {
      pontuacao?: number;
      observacoes_internas?: string;
      tags_avaliacao?: any;
    },
  ) {
    const candidatura = await prisma.candidatura.findFirst({
      where: { id_candidatura, vaga: { id_empresa } },
    });

    if (!candidatura)
      throw new Error("Ação não permitida ou candidatura não encontrada.");

    return await prisma.avaliacaoCandidatura.upsert({
      where: { id_candidatura },
      update: {
        pontuacao: dados.pontuacao ?? null,
        observacoes_internas: dados.observacoes_internas ?? null,
        tags_avaliacao: dados.tags_avaliacao ?? null,
      },
      create: {
        id_candidatura,
        pontuacao: dados.pontuacao ?? null,
        observacoes_internas: dados.observacoes_internas ?? null,
        tags_avaliacao: dados.tags_avaliacao ?? null,
      },
    });
  }

  async obterCurriculosPorLote(idEmpresa: number, idsCandidaturas: number[]) {
    // 1. Validação defensiva no Service
    if (!Array.isArray(idsCandidaturas) || idsCandidaturas.length === 0) {
      throw new Error("O array de IDs de candidaturas não pode estar vazio.");
    }

    // 2. Busca otimizada em lote no Prisma (Evita N+1 queries)
    const candidaturas = await prisma.candidatura.findMany({
      where: {
        id_candidatura: { in: idsCandidaturas },
        // 🔒 SEGURANÇA: Garante que a vaga associada à candidatura pertence à empresa logada!
        vaga: {
          id_empresa: idEmpresa,
        },
      },
      select: {
        id_candidatura: true,
        status_atual: true,
        data_candidatura: true,
        // Puxamos a relação diretamente do modelo Candidatura -> Candidato
        candidato: {
          include: {
            usuario: {
              select: {
                nome: true,
                email: true,
                status: true,
              },
            },
            endereco: true,
            areas_atuacao: {
              include: {
                area: {
                  select: {
                    nome: true,
                  },
                },
              },
            },
            experiencias: {
              orderBy: {
                data_inicio: "desc",
              },
            },
            formacoes: {
              orderBy: {
                data_conclusao: "desc",
              },
            },
            competencias: {
              include: {
                competencia: {
                  select: {
                    nome: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 3. Formatação da resposta para facilitar o uso no Front-end (React/Next.js)
    return candidaturas.map((item) => ({
      id_candidatura: item.id_candidatura,
      status_candidatura: item.status_atual,
      data_candidatura: item.data_candidatura,
      curriculo: {
        ...item.candidato,
        // Simplificando arrays que possuem relações intermediárias (opcional, melhora a UX do DEV no front):
        areas_atuacao:
          item.candidato?.areas_atuacao.map((a) => a.area.nome) || [],
        competencias:
          item.candidato?.competencias.map((c) => ({
            nome: c.competencia.nome,
            nivel: c.nivel,
          })) || [],
      },
    }));
  }
}
