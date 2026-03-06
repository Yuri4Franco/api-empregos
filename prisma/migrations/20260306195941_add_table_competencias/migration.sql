-- CreateEnum
CREATE TYPE "NivelSkill" AS ENUM ('BASICO', 'INTERMEDIARIO', 'AVANCADO');

-- CreateTable
CREATE TABLE "competencias" (
    "id_competencia" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "competencias_pkey" PRIMARY KEY ("id_competencia")
);

-- CreateTable
CREATE TABLE "candidato_competencias" (
    "id_candidato" INTEGER NOT NULL,
    "id_competencia" INTEGER NOT NULL,
    "nivel" "NivelSkill" NOT NULL DEFAULT 'INTERMEDIARIO',

    CONSTRAINT "candidato_competencias_pkey" PRIMARY KEY ("id_candidato","id_competencia")
);

-- CreateTable
CREATE TABLE "vaga_competencias" (
    "id_vaga" INTEGER NOT NULL,
    "id_competencia" INTEGER NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vaga_competencias_pkey" PRIMARY KEY ("id_vaga","id_competencia")
);

-- CreateIndex
CREATE UNIQUE INDEX "competencias_nome_key" ON "competencias"("nome");

-- AddForeignKey
ALTER TABLE "candidato_competencias" ADD CONSTRAINT "candidato_competencias_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidato_competencias" ADD CONSTRAINT "candidato_competencias_id_competencia_fkey" FOREIGN KEY ("id_competencia") REFERENCES "competencias"("id_competencia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_competencias" ADD CONSTRAINT "vaga_competencias_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_competencias" ADD CONSTRAINT "vaga_competencias_id_competencia_fkey" FOREIGN KEY ("id_competencia") REFERENCES "competencias"("id_competencia") ON DELETE RESTRICT ON UPDATE CASCADE;
