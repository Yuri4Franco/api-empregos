-- CreateTable
CREATE TABLE "curriculos_desbloqueados" (
    "id" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "data_desbloqueio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculos_desbloqueados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculos_desbloqueados_id_empresa_id_candidato_key" ON "curriculos_desbloqueados"("id_empresa", "id_candidato");

-- AddForeignKey
ALTER TABLE "curriculos_desbloqueados" ADD CONSTRAINT "curriculos_desbloqueados_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculos_desbloqueados" ADD CONSTRAINT "curriculos_desbloqueados_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
