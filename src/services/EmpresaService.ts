import { prisma } from "../config/prisma.js";
import { startOfDay, endOfDay, subDays } from "date-fns";

export class EmpresaService {
  
  async solicitarDivulgacao(id_empresa: number, dados: any) {
    // Verifica se a vaga pertence à empresa
    const vaga = await prisma.vaga.findFirst({
      where: { id_vaga: dados.id_vaga, id_empresa },
    });

    if (!vaga)
      throw new Error("Vaga não encontrada ou não pertence a esta empresa.");

    return await prisma.solicitacaoMidia.create({
      data: {
        id_vaga: dados.id_vaga,
        id_empresa: id_empresa,
        plataforma: dados.plataforma,
        descricao: dados.descricao,
        status: "PENDENTE",
      },
    });
  }

  async atualizarPerfilInstitucional(id_empresa: number, dados: any) {
    return await prisma.$transaction(async (tx) => {
      // 1. Atualizar dados básicos e links
      const empresa = await tx.empresa.update({
        where: { id_empresa },
        data: {
          nome_fantasia: dados.nome_fantasia,
          quem_somos: dados.quem_somos,
          site: dados.site,
          instagram: dados.instagram,
          linkedin: dados.linkedin,
          facebook: dados.facebook,
        },
      });

      // 2. Sincronizar Benefícios (se enviados)
      if (dados.beneficios_ids) {
        // Remove os antigos para evitar duplicidade
        await tx.empresaBeneficioPadrao.deleteMany({
          where: { id_empresa },
        });

        if (dados.beneficios_ids.length > 0) {
          await tx.empresaBeneficioPadrao.createMany({
            data: dados.beneficios_ids.map((id_ben: number) => ({
              id_empresa,
              id_beneficio: id_ben,
            })),
          });
        }
      }

      return empresa;
    });
  }

  async obterResumoDashboard(id_empresa: number, periodo_dias: number = 30) {
    const hoje = new Date();
    const dataLimite = subDays(hoje, periodo_dias);
    const inicioHoje = startOfDay(hoje);
    const fimHoje = endOfDay(hoje);

    // Executamos múltiplas queries em paralelo para máxima performance
    const [
      vagasStatus,
      totalCandidatos,
      inscritosUltimas24h,
      funilCandidaturas,
      proximasEntrevistas,
      notificacoesPendentes, // 6ª variável
      inscritosNoPeriodo, // ✨ CORREÇÃO: Faltava essa variável (7ª)
      foraDoPerfil, // 8ª variável
    ] = await Promise.all([
      // 1. Vagas por Status (para ver quantas estão Ativas, em Análise, etc)
      prisma.vaga.groupBy({
        by: ["status"],
        where: { id_empresa },
        _count: true,
      }),

      // 2. Total Geral de Inscritos
      prisma.candidatura.count({
        where: { vaga: { id_empresa } },
      }),

      // 3. Inscritos nas últimas 24h (O "calor" do dia)
      prisma.candidatura.count({
        where: {
          vaga: { id_empresa },
          data_candidatura: { gte: subDays(hoje, 1) },
        },
      }),

      // 4. Funil de Candidaturas (Distribuição por Etapa/Status)
      prisma.candidatura.groupBy({
        by: ["status_atual"],
        where: { vaga: { id_empresa } },
        _count: true,
      }),

      // 5. Lista das 5 próximas entrevistas agendadas
      prisma.agendamentoEntrevista.findMany({
        where: {
          candidatura: { vaga: { id_empresa } },
          data_hora: { gte: hoje },
        },
        include: {
          candidatura: {
            select: {
              candidato: {
                select: { usuario: { select: { nome: true } } },
              },
              vaga: { select: { titulo: true } },
            },
          },
        },
        orderBy: { data_hora: "asc" },
        take: 5,
      }),

      // 6. Contador do Safe Send (Feedback pendente) - ✨ CORRIGIDO PARA O NOVO SCHEMA
      prisma.movimentoCandidatura.count({
        where: {
          notificacao_pendente: true,
          candidatura: { vaga: { id_empresa } },
        },
      }),

      // 7. Inscritos no período do Dashboard - ✨ AGORA TEM UMA VARIÁVEL PARA ELE
      prisma.candidatura.count({
        where: {
          vaga: { id_empresa },
          data_candidatura: { gte: dataLimite },
        },
      }),

      // 8. Inteligência de Triagem (Quantos estão "Fora do Perfil")
      prisma.respostaPergunta.count({
        where: {
          fora_do_perfil: true,
          candidatura: { vaga: { id_empresa } },
        },
      }),
    ]);

    // Formatamos os dados para facilitar o consumo no Front-end
    return {
      kpis: {
        vagas_ativas:
          vagasStatus.find((v) => v.status === "ATIVA")?._count || 0,
        total_inscritos: totalCandidatos,
        novos_hoje: inscritosUltimas24h,
        alertas_safe_send: notificacoesPendentes, // Agora reflete a tabela de movimentos!
        candidatos_fora_perfil: foraDoPerfil,
      },
      funil: funilCandidaturas.map((f) => ({
        status: f.status_atual,
        quantidade: f._count,
      })),
      agenda: proximasEntrevistas.map((ent) => ({
        id: ent.id_agendamento,
        candidato: ent.candidatura.candidato.usuario.nome,
        vaga: ent.candidatura.vaga.titulo,
        data_hora: ent.data_hora,
        link: ent.local_link,
      })),
    };
  }

  async atualizarBannerEmpresa(id_empresa: number, url_banner: string) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    return await prisma.empresa.update({
      where: { id_empresa },
      data: { banner_url: url_banner },
      select: { banner_url: true },
    });
  }

  async atualizarLogoEmpresa(id_empresa: number, url_logo: string) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    return await prisma.empresa.update({
      where: { id_empresa },
      data: { logotipo_url: url_logo }, // Nome do campo no seu model
      select: { logotipo_url: true },
    });
  }

  async obterDadosEmpresaPorUsuario(id_usuario: number) {
    const empresa = await prisma.empresa.findFirst({
      where: {
        usuarios: {
          some: { id_usuario: id_usuario },
        },
      },
      include: {
        endereco: true,
        beneficios_padrao: {
          include: {
            beneficio: true,
          },
        },
      },
    });

    if (!empresa) {
      throw new Error("Não encontramos uma empresa vinculada a este usuário.");
    }

    return empresa;
  }

  async listarMeusBeneficiosPadrao(id_empresa: number) {
    const vinculos = await prisma.empresaBeneficioPadrao.findMany({
      where: { id_empresa },
      include: {
        beneficio: true, // Traz a descrição do benefício da tabela Beneficio
      },
    });

    // Mapeamos para retornar uma lista limpa apenas com os dados do benefício
    return vinculos.map((item) => item.beneficio);
  }
}
