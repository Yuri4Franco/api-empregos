import { prisma } from "../config/prisma.js";

interface AtualizarPrecosDTO {
  preco_vaga_nao_associada?: number | string;
  preco_vaga_associada?: number | string;
  preco_pacote_curriculo?: number | string;
  qtd_curriculos_pacote?: number;
}

export class ConfiguracaoPrecoService {

  async obterPrecos() {
    return await prisma.configuracaoPreco.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
      },
    });
  }

  // Atualiza os valores oficiais do sistema
  async atualizarPrecos(dados: AtualizarPrecosDTO) {
    const dadosMapeados = {
      ...(dados.preco_vaga_nao_associada !== undefined && {
        preco_vaga_nao_associada: dados.preco_vaga_nao_associada,
      }),
      ...(dados.preco_vaga_associada !== undefined && {
        preco_vaga_associada: dados.preco_vaga_associada,
      }),
      ...(dados.preco_pacote_curriculo !== undefined && {
        preco_pacote_curriculo: dados.preco_pacote_curriculo,
      }),
      ...(dados.qtd_curriculos_pacote !== undefined && {
        qtd_curriculos_pacote: Number(dados.qtd_curriculos_pacote),
      }),
    };

    return await prisma.configuracaoPreco.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...dadosMapeados,
      },
      update: dadosMapeados,
    });
  }
}
