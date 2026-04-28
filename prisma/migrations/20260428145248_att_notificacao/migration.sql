-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "link_acao" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'INFO';
