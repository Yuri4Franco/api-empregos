import { prisma } from "../config/prisma.js";

export class DashboardCandidatoService {
  async obterMetricas(id_usuario: number) {
    // 1. Busca os dados essenciais para calcular a "Saúde do Currículo"
    const candidato = await prisma.candidato.findUnique({
      where: { id_usuario },
      include: {
        areas_atuacao: true,
        experiencias: { take: 1 },
        formacoes: { take: 1 },
        competencias: { take: 1 },
      },
    });

    if (!candidato) {
      throw new Error("Candidato não encontrado.");
    }

    // --- CÁLCULO DA SAÚDE DO CURRÍCULO ---
    let saude_curriculo = 0;

    // 1. Dados Básicos (25%)
    const temDadosBasicos = Boolean(
      candidato.cpf &&
      candidato.data_nascimento &&
      candidato.objetivo_profissional,
    );
    const temArea = candidato.areas_atuacao.length > 0;
    if (temDadosBasicos && temArea) saude_curriculo += 25;

    // 2. Experiência (25%) - Experiência OU Primeiro Emprego
    if (candidato.experiencias.length > 0 || candidato.primeiro_emprego)
      saude_curriculo += 25;

    // 3. Formação (25%)
    if (candidato.formacoes.length > 0) saude_curriculo += 25;

    // 4. Competências/Habilidades (25%)
    if (candidato.competencias.length > 0) saude_curriculo += 25;

    // --- CONTAGENS (MÉTRICAS) ---
    const idsAreasCandidato = candidato.areas_atuacao.map((a) => a.id_area);

    // Calcula a data de 30 dias atrás para a query de views
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const [
      candidaturas_ativas,
      visualizacoes_perfil,
      vagas_compativeis,
      curriculos_salvos, // 🔥 NOVA MÉTRICA ADICIONADA AQUI
    ] = await Promise.all([
      // 1. Candidaturas Ativas (Onde ele ainda está no páreo)
      prisma.candidatura.count({
        where: {
          id_candidato: id_usuario,
          status_atual: {
            notIn: ["REPROVADO", "DESISTENCIA"],
          },
        },
      }),

      // 2. Visualizações Reais (Últimos 30 dias) usando a nova tabela!
      prisma.visualizacaoCurriculo.count({
        where: {
          id_candidato: id_usuario,
          data_visualizacao: {
            gte: trintaDiasAtras, // gte = Greater Than or Equal (Maior ou igual a)
          },
        },
      }),

      // 3. Vagas Compatíveis (Vagas ativas na área de atuação dele)
      prisma.vaga.count({
        where: {
          status: "ATIVA",
          id_area_atuacao: {
            in: idsAreasCandidato.length > 0 ? idsAreasCandidato : [0],
          },
        },
      }),

      // 4. Currículos Salvos (Quantas empresas deram "Favorito" nesse candidato)
      prisma.curriculoSalvo.count({
        where: { id_candidato: id_usuario },
      }),
    ]);

    // Retorna tudo redondinho pro Front-end!
    return {
      saude_curriculo,
      candidaturas_ativas,
      visualizacoes_perfil, // Agora mostra views reais dos últimos 30 dias!
      vagas_compativeis,
      curriculos_salvos, // Avisa o Front para preparar um card de "Vezes favoritado"
    };
  }

  async listarCandidaturasRecentes(id_usuario: number) {
    const candidaturas = await prisma.candidatura.findMany({
      where: { id_candidato: id_usuario },
      take: 4,
      orderBy: { data_candidatura: "desc" }, // Ordena pelas mais recentes
      include: {
        vaga: {
          select: {
            titulo: true,
            empresa_confidencial: true,
            empresa: {
              select: { nome_fantasia: true, logotipo_url: true },
            },
          },
        },
        agendamento: true, // Traz os dados de entrevista se houver
      },
    });

    return candidaturas.map((c) => {
      const isConfidencial = c.vaga.empresa_confidencial;

      return {
        id_candidatura: c.id_candidatura,
        vaga_titulo: c.vaga.titulo,
        empresa_nome: isConfidencial
          ? "Empresa Confidencial"
          : c.vaga.empresa.nome_fantasia,
        empresa_logo: isConfidencial ? null : c.vaga.empresa.logotipo_url,
        status: c.status_atual,
        data_atualizacao: c.data_candidatura,
        agendamento:
          c.status_atual === "ENTREVISTA" && c.agendamento
            ? {
                data_hora: c.agendamento.data_hora,
                local_link: c.agendamento.local_link,
                observacoes: c.agendamento.observacoes,
              }
            : null,
      };
    });
  }

  async listarVagasRecomendadas(id_usuario: number) {
    // 1. Primeiro, descobrimos quais são as áreas de interesse do candidato
    const candidato = await prisma.candidato.findUnique({
      where: { id_usuario },
      select: {
        areas_atuacao: {
          select: { id_area: true },
        },
      },
    });

    if (!candidato || candidato.areas_atuacao.length === 0) {
      return []; // Se não tem área definida, não temos como recomendar
    }

    const idsAreas = candidato.areas_atuacao.map((a) => a.id_area);

    // 2. Busca as 3 vagas mais recentes nestas áreas
    const vagas = await prisma.vaga.findMany({
      where: {
        status: "ATIVA",
        id_area_atuacao: { in: idsAreas },
      },
      take: 3,
      orderBy: { data_publicacao: "desc" },
      include: {
        empresa: {
          select: { nome_fantasia: true, logotipo_url: true },
        },
        endereco: {
          select: { cidade: true, uf: true },
        },
      },
    });

    // 3. Mapeia para o formato do Card de Radar
    return vagas.map((v) => ({
      id_vaga: v.id_vaga,
      titulo: v.titulo,
      empresa_nome: v.empresa_confidencial
        ? "Empresa Confidencial"
        : v.empresa.nome_fantasia,
      empresa_logo: v.empresa_confidencial ? null : v.empresa.logotipo_url,
      localizacao: v.endereco
        ? `${v.endereco.cidade} - ${v.endereco.uf}`
        : "Remoto",
      modelo_trabalho: v.modelo_trabalho,
      tipo_contrato: v.tipo_contrato,
      faixa_salarial: v.ocultar_salario
        ? "A combinar"
        : v.faixa_salarial_de && v.faixa_salarial_ate
          ? `R$ ${v.faixa_salarial_de} - ${v.faixa_salarial_ate}`
          : "A combinar",
      criado_em: v.data_publicacao,
    }));
  }
}
