/*
  Warnings:

  - Changed the column `tipo_contato` on the `candidatos` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterTable
ALTER TABLE "candidatos" ALTER COLUMN "tipo_contato" DROP DEFAULT,
ALTER COLUMN "tipo_contato" SET DATA TYPE "TipoContato"[] USING ARRAY["tipo_contato"]::"TipoContato"[];