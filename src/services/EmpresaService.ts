import { prisma } from "../config/prisma.js";

export class EmpresaService {
  async visualizarPerfilCandidato(id_empresa: number, id_candidato: number) {
    // 1. Verificar se a empresa já desbloqueou este candidato antes
    // Podemos usar a tabela LogAuditoria ou criar uma tabela de 'Desbloqueios'
    // Aqui, vamos checar se a empresa já teve alguma interação de sucesso
    const jaAcessou = await prisma.logAuditoria.findFirst({
      where: {
        id_usuario: id_empresa, // Adaptar conforme seu log
        entidade: "CANDIDATO",
        id_entidade: id_candidato,
        acao: "DESBLOQUEIO_CURRICULO",
      },
    });

    if (jaAcessou) {
      return this.buscarPerfilCompleto(id_candidato);
    }

    // 2. Se não acessou, verificar créditos
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { creditos_curriculos: true, tipo_vinculo_aci: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // Associadas podem ter regras diferentes, mas aqui seguimos o padrão de crédito
    if (empresa.creditos_curriculos <= 0) {
      throw new Error("Saldo de créditos de currículo insuficiente.");
    }

    // 3. Deduzir crédito e registrar acesso em transação
    return await prisma.$transaction(async (tx) => {
      await tx.empresa.update({
        where: { id_empresa },
        data: { creditos_curriculos: { decrement: 1 } },
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_empresa,
          entidade: "CANDIDATO",
          id_entidade: id_candidato,
          acao: "DESBLOQUEIO_CURRICULO",
          detalhes: { data: new Date() },
        },
      });

      return this.buscarPerfilCompleto(id_candidato, tx);
    });
  }

  private async buscarPerfilCompleto(id_candidato: number, tx: any = prisma) {
    return await tx.candidato.findUnique({
      where: { id_usuario: id_candidato },
      include: {
        usuario: { select: { nome: true, email: true } },
        experiencias: true,
        formacoes: true,
      },
    });
  }

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
          logotipo_url: dados.logotipo_url,
          banner_url: dados.banner_url,
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

        // Adiciona os novos selecionados
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
}
