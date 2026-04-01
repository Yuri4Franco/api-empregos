-- CreateTable
CREATE TABLE "vagas_configuracoes" (
    "id_configuracao" SERIAL NOT NULL,
    "id_vaga" INTEGER NOT NULL,
    "campos_destaque" JSONB,

    CONSTRAINT "vagas_configuracoes_pkey" PRIMARY KEY ("id_configuracao")
);

-- CreateIndex
CREATE UNIQUE INDEX "vagas_configuracoes_id_vaga_key" ON "vagas_configuracoes"("id_vaga");

-- AddForeignKey
ALTER TABLE "vagas_configuracoes" ADD CONSTRAINT "vagas_configuracoes_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;
