-- CreateTable
CREATE TABLE "configuracoes_precos" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "preco_vaga_nao_associada" DECIMAL(10,2) NOT NULL DEFAULT 70.00,
    "preco_vaga_associada" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "preco_pacote_curriculo" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "qtd_curriculos_pacote" INTEGER NOT NULL DEFAULT 10,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_precos_pkey" PRIMARY KEY ("id")
);
