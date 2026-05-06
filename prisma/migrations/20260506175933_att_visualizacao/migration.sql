-- AlterTable
ALTER TABLE "candidaturas" ADD COLUMN     "data_visualizacao" TIMESTAMP(3),
ADD COLUMN     "visualizada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "visualizacoes_curriculo" (
    "id_visualizacao" SERIAL NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "data_visualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visualizacoes_curriculo_pkey" PRIMARY KEY ("id_visualizacao")
);

-- CreateIndex
CREATE INDEX "visualizacoes_curriculo_id_candidato_data_visualizacao_idx" ON "visualizacoes_curriculo"("id_candidato", "data_visualizacao");

-- AddForeignKey
ALTER TABLE "visualizacoes_curriculo" ADD CONSTRAINT "visualizacoes_curriculo_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visualizacoes_curriculo" ADD CONSTRAINT "visualizacoes_curriculo_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE CASCADE ON UPDATE CASCADE;
