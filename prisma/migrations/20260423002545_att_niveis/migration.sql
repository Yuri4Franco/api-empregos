/*
  Warnings:

  - The values [CLT,TEMPORARIO] on the enum `TipoContrato` will be removed. If these variants are still used in the database, this will fail.
  - The `nivel_hierarquico` column on the `vagas` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NivelHierarquico" AS ENUM ('JOVEM_APRENDIZ', 'ESTAGIO', 'TRAINEE', 'OPERACIONAL', 'ASSISTENTE', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'SUPERVISAO', 'GERENCIA', 'DIRETORIA', 'NAO_SE_APLICA');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoContrato_new" AS ENUM ('CLT_EFETIVO', 'CLT_TEMPORARIO', 'CLT_INTERMITENTE', 'PJ', 'AUTONOMO', 'FREELANCE', 'ESTAGIO', 'JOVEM_APRENDIZ', 'COOPERADO', 'OUTROS');
ALTER TABLE "vagas" ALTER COLUMN "tipo_contrato" TYPE "TipoContrato_new" USING ("tipo_contrato"::text::"TipoContrato_new");
ALTER TYPE "TipoContrato" RENAME TO "TipoContrato_old";
ALTER TYPE "TipoContrato_new" RENAME TO "TipoContrato";
DROP TYPE "public"."TipoContrato_old";
COMMIT;

-- AlterTable
ALTER TABLE "vagas" DROP COLUMN "nivel_hierarquico",
ADD COLUMN     "nivel_hierarquico" "NivelHierarquico" NOT NULL DEFAULT 'NAO_SE_APLICA';
