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
}
