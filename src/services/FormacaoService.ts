import { prisma } from "../config/prisma.js";
import { CandidatoService } from "./CandidatoService.js";

const candidatoService = new CandidatoService();

export class FormacaoService {
  async criar(id_usuario: number, dados: any) {
    // 1. Salva no banco e guarda o resultado
    const novaFormacao = await prisma.formacaoAcademica.create({
      data: {
        ...dados,
        id_candidato: id_usuario,
      },
    });

    // 2. Dispara o gatilho DEPOIS de salvar, mas ANTES do return
    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    // 3. Retorna o resultado para quem chamou a função
    return {
      formacao: novaFormacao,
      porcentagem_curriculo: novaNota,
    };
  }

  async atualizar(id_formacao: number, id_usuario: number, dados: any) {
    // Trava: garante que a formação é dele
    const formacao = await prisma.formacaoAcademica.findFirst({
      where: { id_formacao, id_candidato: id_usuario },
    });

    if (!formacao)
      throw new Error("Formação não encontrada ou permissão negada.");

    // 1. Atualiza no banco
    const formacaoAtualizada = await prisma.formacaoAcademica.update({
      where: { id_formacao },
      data: dados,
    });

    // 2. Dispara o gatilho para garantir que a nota reflita a edição
    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    // 3. Retorna
    return {
      formacao: formacaoAtualizada,
      porcentagem_curriculo: novaNota,
    };
  }

  async deletar(id_formacao: number, id_usuario: number) {
    // Trava: garante que a formação é dele
    const formacao = await prisma.formacaoAcademica.findFirst({
      where: { id_formacao, id_candidato: id_usuario },
    });

    if (!formacao)
      throw new Error("Formação não encontrada ou permissão negada.");

    // 1. Deleta do banco
    const formacaoDeletada = await prisma.formacaoAcademica.delete({
      where: { id_formacao },
    });

    // 2. Dispara o gatilho (Se ele deletou a última formação, ele perde os 10 pontos)
    const novaNota =
      await candidatoService.atualizarPorcentagemCurriculo(id_usuario);

    return {
      formacao: formacaoDeletada,
      porcentagem_curriculo: novaNota,
    };
  }
}
