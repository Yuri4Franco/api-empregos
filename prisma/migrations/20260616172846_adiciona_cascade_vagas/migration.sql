-- DropForeignKey
ALTER TABLE "etapas_processo" DROP CONSTRAINT "etapas_processo_id_vaga_fkey";

-- DropForeignKey
ALTER TABLE "solicitacoes_midia" DROP CONSTRAINT "solicitacoes_midia_id_vaga_fkey";

-- DropForeignKey
ALTER TABLE "vaga_beneficios" DROP CONSTRAINT "vaga_beneficios_id_vaga_fkey";

-- DropForeignKey
ALTER TABLE "vaga_competencias" DROP CONSTRAINT "vaga_competencias_id_vaga_fkey";

-- DropForeignKey
ALTER TABLE "vaga_perguntas_eliminatorias" DROP CONSTRAINT "vaga_perguntas_eliminatorias_id_vaga_fkey";

-- DropForeignKey
ALTER TABLE "vagas_configuracoes" DROP CONSTRAINT "vagas_configuracoes_id_vaga_fkey";

-- AddForeignKey
ALTER TABLE "vagas_configuracoes" ADD CONSTRAINT "vagas_configuracoes_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_processo" ADD CONSTRAINT "etapas_processo_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_perguntas_eliminatorias" ADD CONSTRAINT "vaga_perguntas_eliminatorias_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_beneficios" ADD CONSTRAINT "vaga_beneficios_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_competencias" ADD CONSTRAINT "vaga_competencias_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_midia" ADD CONSTRAINT "solicitacoes_midia_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE CASCADE ON UPDATE CASCADE;
