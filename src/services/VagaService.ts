import { prisma } from "../config/prisma.js";
import { StatusVaga } from "@prisma/client";

export class VagaService {
  async criarVaga(dados: any, id_empresa: number, is_admin: boolean = false) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_vagas: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    let statusFinal: StatusVaga = StatusVaga.RASCUNHO;
    if (is_admin) statusFinal = StatusVaga.ATIVA;
    else if (dados.enviar_para_aprovacao) statusFinal = StatusVaga.EM_ANALISE;

    const consomeCredito =
      statusFinal === StatusVaga.EM_ANALISE ||
      (is_admin && empresa.tipo_vinculo_aci === "NAO_ASSOCIADA");

    if (
      !is_admin &&
      empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
      consomeCredito
    ) {
      if (empresa.creditos_vagas <= 0)
        throw new Error("Saldo de vagas insuficiente.");
    }

    return await prisma.$transaction(async (tx) => {
      const vaga = await tx.vaga.create({
        data: {
          id_empresa,
          titulo: dados.titulo,
          area_profissional: dados.area_professional,
          nivel_hierarquico: dados.nivel_hierarquico,
          cidade: dados.cidade,
          uf: dados.uf,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          modelo_trabalho: dados.modelo_trabalho,
          tipo_contrato: dados.tipo_contrato,
          faixa_salarial_de: dados.salario_a_combinar
            ? null
            : dados.faixa_salarial_de,
          faixa_salarial_ate: dados.salario_a_combinar
            ? null
            : dados.faixa_salarial_ate,
          salario_a_combinar: dados.salario_a_combinar || false,
          ocultar_salario: dados.ocultar_salario || false,
          descricao: dados.descricao,
          responsabilidades: dados.responsabilidades,
          requisitos_obrigatorios: dados.requisitos_obrigatorios,
          diferenciais: dados.diferenciais,
          empresa_confidencial: dados.empresa_confidencial || false,
          status: statusFinal,
          data_publicacao: statusFinal === StatusVaga.ATIVA ? new Date() : null,
        },
      });

      if (dados.etapas && dados.etapas.length > 0) {
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any) => ({
            id_vaga: vaga.id_vaga,
            nome: e.nome,
            ordem: e.ordem,
            tipo: e.tipo,
            requer_agendamento: e.requer_agendamento || false,
          })),
        });
      }

      if (dados.perguntas && dados.perguntas.length > 0) {
        await tx.vagaPerguntaEliminatoria.createMany({
          data: dados.perguntas.map((p: any) => ({
            id_vaga: vaga.id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }

      if (
        !is_admin &&
        empresa.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
        statusFinal === StatusVaga.EM_ANALISE
      ) {
        await tx.empresa.update({
          where: { id_empresa },
          data: { creditos_vagas: { decrement: 1 } },
        });
      }

      return vaga;
    });
  }

  async atualizarVaga(
    id_vaga: number,
    id_empresa: number,
    dados: any,
    is_admin: boolean = false,
  ) {
    // 1. Verificar se a vaga existe e pertence à empresa
    const vagaExistente = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      include: { etapas: true, perguntas_eliminatorias: true },
    });

    if (!vagaExistente) {
      throw new Error(
        "Vaga não encontrada ou você não tem permissão para editá-la.",
      );
    }

    // 2. Trava de segurança: Se a vaga já estiver ATIVA, evitar mudar dados críticos
    // ou decidir se ela deve voltar para análise após edição.
    const enviandoParaAnalise =
      !is_admin &&
      dados.enviar_para_aprovacao &&
      vagaExistente.status === "RASCUNHO";

    // 3. Lógica de Crédito na Edição
    if (enviandoParaAnalise) {
      const empresa = await prisma.empresa.findUnique({
        where: { id_empresa },
        select: { tipo_vinculo_aci: true, creditos_vagas: true },
      });

      if (
        empresa?.tipo_vinculo_aci === "NAO_ASSOCIADA" &&
        empresa.creditos_vagas <= 0
      ) {
        throw new Error(
          "Saldo de vagas insuficiente para publicar este rascunho.",
        );
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 4. Atualizar dados básicos da Vaga
      const vagaAtualizada = await tx.vaga.update({
        where: { id_vaga },
        data: {
          titulo: dados.titulo,
          area_profissional: dados.area_professional,
          nivel_hierarquico: dados.nivel_hierarquico,
          cidade: dados.cidade,
          uf: dados.uf,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          modelo_trabalho: dados.modelo_trabalho,
          tipo_contrato: dados.tipo_contrato,
          descricao: dados.descricao,
          responsabilidades: dados.responsabilidades,
          requisitos_obrigatorios: dados.requisitos_obrigatorios,
          diferenciais: dados.diferenciais,
          salario_a_combinar: dados.salario_a_combinar,
          faixa_salarial_de: dados.salario_a_combinar
            ? null
            : dados.faixa_salarial_de,
          faixa_salarial_ate: dados.salario_a_combinar
            ? null
            : dados.faixa_salarial_ate,
          ocultar_salario: dados.ocultar_salario,
          empresa_confidencial: dados.empresa_confidencial,
          // Se enviou para aprovação agora, muda o status
          status: enviandoParaAnalise ? "EM_ANALISE" : vagaExistente.status,
        },
      });

      // 5. Atualizar Etapas (Lógica simples: deleta as antigas e cria as novas)
      if (dados.etapas) {
        await tx.etapaProcesso.deleteMany({ where: { id_vaga } });
        await tx.etapaProcesso.createMany({
          data: dados.etapas.map((e: any) => ({
            id_vaga,
            nome: e.nome,
            ordem: e.ordem,
            tipo: e.tipo,
            requer_agendamento: e.requer_agendamento || false,
          })),
        });
      }

      // 6. Atualizar Perguntas Eliminatórias
      if (dados.perguntas) {
        await tx.vagaPerguntaEliminatoria.deleteMany({ where: { id_vaga } });
        await tx.vagaPerguntaEliminatoria.createMany({
          data: dados.perguntas.map((p: any) => ({
            id_vaga,
            id_pergunta: p.id_pergunta,
            resposta_esperada: p.resposta_esperada,
          })),
        });
      }

      // 7. Consumir crédito se estiver saindo de Rascunho para Análise agora
      if (enviandoParaAnalise) {
        await tx.empresa.update({
          where: { id_empresa },
          data: { creditos_vagas: { decrement: 1 } },
        });
      }

      return vagaAtualizada;
    });
  }

  async listarVagasPorEmpresa(id_empresa: number) {
    return await prisma.vaga.findMany({
      where: { id_empresa },
      include: {
        _count: { select: { candidaturas: true } },
      },
      orderBy: { id_vaga: "desc" },
    });
  }

  async listarVagasPendentes() {
    return await prisma.vaga.findMany({
      where: { status: "EM_ANALISE" },
      include: {
        empresa: {
          select: { nome_fantasia: true, razao_social: true },
        },
      },
      orderBy: { id_vaga: "asc" },
    });
  }

  /**
   * Altera o status da vaga após revisão humana.
   * Se aprovada, ganha data de publicação.
   */
  async moderarVaga(id_vaga: number, novoStatus: "ATIVA" | "REPROVADA") {
    const vaga = await prisma.vaga.findUnique({ where: { id_vaga } });

    if (!vaga) throw new Error("Vaga não encontrada.");
    if (vaga.status !== "EM_ANALISE") {
      throw new Error(
        `Esta vaga não pode ser moderada pois seu status atual é ${vaga.status}`,
      );
    }

    return await prisma.vaga.update({
      where: { id_vaga },
      data: {
        status: novoStatus,
        data_publicacao: novoStatus === "ATIVA" ? new Date() : null,
        // Aqui poderíamos adicionar um campo 'motivo_reprovacao' no Model futuramente
      },
    });
  }

  async listarVagasPublicas(filtros: {
    cidade?: string;
    uf?: string;
    area?: string;
    modelo?: string;
    pagina?: number;
  }) {
    const itensPorPagina = 10;
    const skip = ((filtros.pagina || 1) - 1) * itensPorPagina;

    const where: any = {
      status: "ATIVA",
    };

    if (filtros.cidade) where.cidade = { contains: filtros.cidade };
    if (filtros.uf) where.uf = filtros.uf;
    if (filtros.area) where.area_profissional = filtros.area;
    if (filtros.modelo) where.modelo_trabalho = filtros.modelo;

    const [vagas, total] = await prisma.$transaction([
      prisma.vaga.findMany({
        where,
        select: {
          id_vaga: true,
          titulo: true,
          cidade: true,
          uf: true,
          area_profissional: true,
          modelo_trabalho: true,
          tipo_contrato: true,
          faixa_salarial_de: true,
          faixa_salarial_ate: true,
          ocultar_salario: true,
          empresa_confidencial: true, // ESTÁ AQUI: O campo pertence à Vaga
          data_publicacao: true,
          empresa: {
            select: {
              nome_fantasia: true,
              // Removido 'empresa_confidencial' daqui pois ele não existe no model Empresa
            },
          },
        },
        orderBy: { data_publicacao: "desc" },
        skip,
        take: itensPorPagina,
      }),
      prisma.vaga.count({ where }),
    ]);

    return {
      vagas,
      totalPaginas: Math.ceil(total / itensPorPagina),
      totalRegistros: total,
    };
  }

  async buscarPorId(id_vaga: number) {
    const vaga = await prisma.vaga.findUnique({
      where: { id_vaga },
      include: {
        empresa: {
          select: {
            nome_fantasia: true,
            razao_social: true,
            // Adicione outros campos da empresa que achar relevante mostrar no detalhe
          },
        },
        beneficios: true, // Se houver relação com benefícios
        perguntas_eliminatorias: {
          include: {
            pergunta: true, // Para trazer o texto da pergunta cadastrada no banco
          },
        },
      },
    });

    if (!vaga) {
      throw new Error("Vaga não encontrada.");
    }

    // Se a vaga não estiver ativa, apenas o dono ou admin deveriam ver (lógica opcional)
    // Por enquanto, vamos retornar para permitir a visualização
    return vaga;
  }

  async listarCandidatosPorVaga(id_vaga: number, id_empresa: number) {
    // 1. Validar se a vaga pertence à empresa
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga, id_empresa },
      select: { titulo: true },
    });

    if (!vaga) throw new Error("Vaga não encontrada ou acesso negado.");

    // 2. Buscar as candidaturas com os dados dos candidatos e etapas
    const candidaturas = await prisma.candidatura.findMany({
      where: { id_vaga },
      include: {
        candidato: {
          include: {
            usuario: {
              select: { nome: true, email: true },
            },
          },
        },
        // Traz a descrição da etapa atual do candidato
        vaga: {
          select: {
            etapas: {
              where: {
                // Isso ajuda a mapear o nome da etapa no front
              },
            },
          },
        },
      },
      orderBy: { data_candidatura: "desc" },
    });

    return {
      vaga_titulo: vaga.titulo,
      candidatos: candidaturas.map((c) => ({
        id_candidatura: c.id_candidatura,
        id_candidato: c.id_candidato,
        nome: c.candidato.usuario.nome,
        cidade: c.candidato.cidade,
        uf: c.candidato.uf,
        status: c.status_atual,
        id_etapa_atual: c.id_etapa_atual,
        data_inscricao: c.data_candidatura,
      })),
    };
  }
}
