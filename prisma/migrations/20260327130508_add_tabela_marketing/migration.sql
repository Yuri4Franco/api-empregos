-- CreateEnum
CREATE TYPE "StatusMidia" AS ENUM ('PENDENTE', 'AGENDADO', 'POSTADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "solicitacoes_midia" (
    "id_solicitacao" SERIAL NOT NULL,
    "id_vaga" INTEGER NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "plataforma" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusMidia" NOT NULL DEFAULT 'PENDENTE',
    "justificativa" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_midia_pkey" PRIMARY KEY ("id_solicitacao")
);

-- AddForeignKey
ALTER TABLE "solicitacoes_midia" ADD CONSTRAINT "solicitacoes_midia_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_midia" ADD CONSTRAINT "solicitacoes_midia_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;
