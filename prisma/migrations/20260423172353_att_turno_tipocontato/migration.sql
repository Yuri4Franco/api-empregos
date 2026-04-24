-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('WHATSAPP', 'EMAIL', 'LIGACAO', 'QUALQUER_UM');

-- AlterTable
ALTER TABLE "candidatos" ADD COLUMN     "necessidade" TEXT,
ADD COLUMN     "tipo_contato" "TipoContato" DEFAULT 'WHATSAPP';
