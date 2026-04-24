-- CreateTable
CREATE TABLE "curriculos_salvos" (
    "id_salvo" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculos_salvos_pkey" PRIMARY KEY ("id_salvo")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculos_salvos_id_empresa_id_candidato_key" ON "curriculos_salvos"("id_empresa", "id_candidato");

-- AddForeignKey
ALTER TABLE "curriculos_salvos" ADD CONSTRAINT "curriculos_salvos_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculos_salvos" ADD CONSTRAINT "curriculos_salvos_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
