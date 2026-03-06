-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADM', 'CANDIDATO', 'EMPRESA');

-- CreateEnum
CREATE TYPE "StatusGeral" AS ENUM ('ATIVO', 'PENDENTE', 'BLOQUEADO', 'QUARENTENA');

-- CreateEnum
CREATE TYPE "TipoVinculoACI" AS ENUM ('ASSOCIADA', 'NAO_ASSOCIADA');

-- CreateEnum
CREATE TYPE "ModeloTrabalho" AS ENUM ('PRESENCIAL', 'HIBRIDO', 'REMOTO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('CLT', 'PJ', 'ESTAGIO', 'TEMPORARIO');

-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('RASCUNHO', 'EM_ANALISE', 'ATIVA', 'PAUSADA', 'ENCERRADA', 'AGUARDANDO_PAGAMENTO');

-- CreateEnum
CREATE TYPE "StatusCandidatura" AS ENUM ('INSCRITO', 'TRIAGEM', 'ENTREVISTA', 'APROVADO', 'REPROVADO', 'DESISTENCIA');

-- CreateEnum
CREATE TYPE "TipoEtapa" AS ENUM ('INICIAL', 'INTERMEDIARIA', 'FINAL');

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "tipo_usuario" "TipoUsuario" NOT NULL,
    "status" "StatusGeral" NOT NULL DEFAULT 'PENDENTE',
    "is_master" BOOLEAN NOT NULL DEFAULT false,
    "id_empresa" INTEGER,
    "data_exclusao" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "ultimo_login" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "candidatos" (
    "id_usuario" INTEGER NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "cidade" TEXT,
    "bairro" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "genero" TEXT,
    "link_linkedin" TEXT,
    "link_portfolio" TEXT,
    "pcd" BOOLEAN NOT NULL DEFAULT false,
    "tipo_pcd" TEXT,
    "perfil_visivel_empresas" BOOLEAN NOT NULL DEFAULT true,
    "objetivo_profissional" TEXT,
    "pretensao_salarial" DECIMAL(10,2),
    "resumo_profissional" TEXT,
    "disponibilidade_viagem" BOOLEAN NOT NULL DEFAULT false,
    "disponibilidade_mudanca" BOOLEAN NOT NULL DEFAULT false,
    "turno_preferido" TEXT,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id_empresa" SERIAL NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "tipo_vinculo_aci" "TipoVinculoACI" NOT NULL DEFAULT 'NAO_ASSOCIADA',
    "logotipo_url" TEXT,
    "banner_url" TEXT,
    "quem_somos" TEXT,
    "site" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "cidade" TEXT,
    "bairro" TEXT,
    "creditos_vagas" INTEGER NOT NULL DEFAULT 0,
    "creditos_curriculos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id_empresa")
);

-- CreateTable
CREATE TABLE "vagas" (
    "id_vaga" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "area_profissional" TEXT NOT NULL,
    "nivel_hierarquico" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "modelo_trabalho" "ModeloTrabalho" NOT NULL,
    "tipo_contrato" "TipoContrato" NOT NULL,
    "faixa_salarial_de" DECIMAL(10,2),
    "faixa_salarial_ate" DECIMAL(10,2),
    "salario_a_combinar" BOOLEAN NOT NULL DEFAULT false,
    "ocultar_salario" BOOLEAN NOT NULL DEFAULT false,
    "descricao" TEXT NOT NULL,
    "responsabilidades" TEXT,
    "requisitos_obrigatorios" TEXT,
    "diferenciais" TEXT,
    "empresa_confidencial" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusVaga" NOT NULL DEFAULT 'RASCUNHO',
    "data_publicacao" TIMESTAMP(3),
    "data_encerramento" TIMESTAMP(3),

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id_vaga")
);

-- CreateTable
CREATE TABLE "etapas_processo" (
    "id_etapa" SERIAL NOT NULL,
    "id_vaga" INTEGER NOT NULL,
    "nome_etapa" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "TipoEtapa" NOT NULL DEFAULT 'INTERMEDIARIA',
    "requer_agendamento" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "etapas_processo_pkey" PRIMARY KEY ("id_etapa")
);

-- CreateTable
CREATE TABLE "candidaturas" (
    "id_candidatura" SERIAL NOT NULL,
    "id_vaga" INTEGER NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "id_etapa_atual" INTEGER NOT NULL,
    "status_atual" "StatusCandidatura" NOT NULL DEFAULT 'INSCRITO',
    "data_candidatura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificacao_pendente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id_candidatura")
);

-- CreateTable
CREATE TABLE "movimentos_candidatura" (
    "id_movimento" SERIAL NOT NULL,
    "id_candidatura" INTEGER NOT NULL,
    "etapa_origem" INTEGER,
    "etapa_destino" INTEGER NOT NULL,
    "status_destino" "StatusCandidatura" NOT NULL,
    "motivo" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_candidatura_pkey" PRIMARY KEY ("id_movimento")
);

-- CreateTable
CREATE TABLE "perguntas_eliminatorias" (
    "id_pergunta" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "perguntas_eliminatorias_pkey" PRIMARY KEY ("id_pergunta")
);

-- CreateTable
CREATE TABLE "vaga_perguntas_eliminatorias" (
    "id_vaga" INTEGER NOT NULL,
    "id_pergunta" INTEGER NOT NULL,
    "resposta_esperada" TEXT NOT NULL,

    CONSTRAINT "vaga_perguntas_eliminatorias_pkey" PRIMARY KEY ("id_vaga","id_pergunta")
);

-- CreateTable
CREATE TABLE "respostas_perguntas" (
    "id_resposta" SERIAL NOT NULL,
    "id_candidatura" INTEGER NOT NULL,
    "id_pergunta" INTEGER NOT NULL,
    "resposta" TEXT NOT NULL,
    "fora_do_perfil" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "respostas_perguntas_pkey" PRIMARY KEY ("id_resposta")
);

-- CreateTable
CREATE TABLE "beneficios" (
    "id_beneficio" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "beneficios_pkey" PRIMARY KEY ("id_beneficio")
);

-- CreateTable
CREATE TABLE "avaliacoes_empresa" (
    "id_avaliacao" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "motivos_tags" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_empresa_pkey" PRIMARY KEY ("id_avaliacao")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id_log" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "entidade" TEXT NOT NULL,
    "id_entidade" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "empresa_beneficios_padrao" (
    "id_empresa" INTEGER NOT NULL,
    "id_beneficio" INTEGER NOT NULL,

    CONSTRAINT "empresa_beneficios_padrao_pkey" PRIMARY KEY ("id_empresa","id_beneficio")
);

-- CreateTable
CREATE TABLE "vaga_beneficios" (
    "id_vaga" INTEGER NOT NULL,
    "id_beneficio" INTEGER NOT NULL,

    CONSTRAINT "vaga_beneficios_pkey" PRIMARY KEY ("id_vaga","id_beneficio")
);

-- CreateTable
CREATE TABLE "experiencias_profissionais" (
    "id_experiencia" SERIAL NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "empresa" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "atividades" TEXT,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "atual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "experiencias_profissionais_pkey" PRIMARY KEY ("id_experiencia")
);

-- CreateTable
CREATE TABLE "formacoes_academicas" (
    "id_formacao" SERIAL NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "instituicao" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data_conclusao" TIMESTAMP(3),

    CONSTRAINT "formacoes_academicas_pkey" PRIMARY KEY ("id_formacao")
);

-- CreateTable
CREATE TABLE "tickets_suporte" (
    "id_ticket" SERIAL NOT NULL,
    "id_usuario" INTEGER,
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_suporte_pkey" PRIMARY KEY ("id_ticket")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id_notificacao" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id_notificacao")
);

-- CreateTable
CREATE TABLE "ouvidoria_relatos" (
    "id_relato" SERIAL NOT NULL,
    "id_candidato" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ouvidoria_relatos_pkey" PRIMARY KEY ("id_relato")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidatos_cpf_key" ON "candidatos"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "beneficios_descricao_key" ON "beneficios"("descricao");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_processo" ADD CONSTRAINT "etapas_processo_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_candidatura" ADD CONSTRAINT "movimentos_candidatura_id_candidatura_fkey" FOREIGN KEY ("id_candidatura") REFERENCES "candidaturas"("id_candidatura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_perguntas_eliminatorias" ADD CONSTRAINT "vaga_perguntas_eliminatorias_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_perguntas_eliminatorias" ADD CONSTRAINT "vaga_perguntas_eliminatorias_id_pergunta_fkey" FOREIGN KEY ("id_pergunta") REFERENCES "perguntas_eliminatorias"("id_pergunta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_perguntas" ADD CONSTRAINT "respostas_perguntas_id_candidatura_fkey" FOREIGN KEY ("id_candidatura") REFERENCES "candidaturas"("id_candidatura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_empresa" ADD CONSTRAINT "avaliacoes_empresa_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_empresa" ADD CONSTRAINT "avaliacoes_empresa_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_beneficios_padrao" ADD CONSTRAINT "empresa_beneficios_padrao_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_beneficios_padrao" ADD CONSTRAINT "empresa_beneficios_padrao_id_beneficio_fkey" FOREIGN KEY ("id_beneficio") REFERENCES "beneficios"("id_beneficio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_beneficios" ADD CONSTRAINT "vaga_beneficios_id_vaga_fkey" FOREIGN KEY ("id_vaga") REFERENCES "vagas"("id_vaga") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_beneficios" ADD CONSTRAINT "vaga_beneficios_id_beneficio_fkey" FOREIGN KEY ("id_beneficio") REFERENCES "beneficios"("id_beneficio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiencias_profissionais" ADD CONSTRAINT "experiencias_profissionais_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacoes_academicas" ADD CONSTRAINT "formacoes_academicas_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_suporte" ADD CONSTRAINT "tickets_suporte_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ouvidoria_relatos" ADD CONSTRAINT "ouvidoria_relatos_id_candidato_fkey" FOREIGN KEY ("id_candidato") REFERENCES "candidatos"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
