-- CreateTable
CREATE TABLE "agendamentos_entrevista" (
    "id_agendamento" SERIAL NOT NULL,
    "id_candidatura" INTEGER NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "local_link" TEXT NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_entrevista_pkey" PRIMARY KEY ("id_agendamento")
);

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_entrevista_id_candidatura_key" ON "agendamentos_entrevista"("id_candidatura");

-- AddForeignKey
ALTER TABLE "agendamentos_entrevista" ADD CONSTRAINT "agendamentos_entrevista_id_candidatura_fkey" FOREIGN KEY ("id_candidatura") REFERENCES "candidaturas"("id_candidatura") ON DELETE RESTRICT ON UPDATE CASCADE;
