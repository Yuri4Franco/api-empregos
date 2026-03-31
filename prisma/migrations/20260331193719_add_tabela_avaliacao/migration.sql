-- CreateTable
CREATE TABLE "avaliacoes_candidatura" (
    "id_avaliacao" SERIAL NOT NULL,
    "id_candidatura" INTEGER NOT NULL,
    "pontuacao" INTEGER,
    "observacoes_internas" TEXT,
    "tags_avaliacao" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_candidatura_pkey" PRIMARY KEY ("id_avaliacao")
);

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_candidatura_id_candidatura_key" ON "avaliacoes_candidatura"("id_candidatura");

-- AddForeignKey
ALTER TABLE "avaliacoes_candidatura" ADD CONSTRAINT "avaliacoes_candidatura_id_candidatura_fkey" FOREIGN KEY ("id_candidatura") REFERENCES "candidaturas"("id_candidatura") ON DELETE RESTRICT ON UPDATE CASCADE;
