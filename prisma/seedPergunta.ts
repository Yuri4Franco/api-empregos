import { prisma } from "../src/config/prisma";

async function main() {
  const PerguntasEliminatorias = [
    // Habilitação (CNH)
    "Você possui Carteira Nacional de Habilitação (CNH) na categoria A ativa e regular?",
    "Você possui Carteira Nacional de Habilitação (CNH) na categoria B ativa e regular?",
    "Você possui Carteira Nacional de Habilitação (CNH) na categoria AB ativa e regular?",
    "Você possui Carteira Nacional de Habilitação (CNH) na categoria C ativa e regular?",
    "Você possui Carteira Nacional de Habilitação (CNH) na categoria D ativa e regular?",
    "Você possui Carteira Nacional de Habilitação (CNH) na categoria E ativa e regular?",
    "Você está ciente e de acordo com a realização do exame toxicológico obrigatório (exigido para as categorias B, C, D e E)?",

    // Disponibilidade e Logística
    "Você possui disponibilidade total para trabalhar no turno da Manhã?",
    "Você possui disponibilidade total para trabalhar no turno da Tarde?",
    "Você possui disponibilidade total para trabalhar no turno da Noite?",
    "Você possui disponibilidade total para trabalhar no turno da Madrugada?",
    "Você tem disponibilidade para trabalhar aos finais de semana e feriados, conforme escala pré-definida?",
    "O modelo de trabalho é 100% presencial. Você tem viabilidade para cumprir este formato?",
    "Você reside na região da vaga ou possui disponibilidade para mudança imediata?",
    "Você possui disponibilidade para viagens corporativas frequentes?",

    // Formação e Certificações
    "Você possui o Ensino Médio completo e comprovado?",
    "Você possui o Ensino Técnico completo e comprovado na área da vaga?",
    "Você possui o Ensino Superior completo e comprovado na área da vaga?",
    "Você possui registro ativo e regular no conselho de classe exigido para esta função?",

    // Experiência
    "Você possui comprovação de experiência prévia de até 6 meses nesta atividade?",

    // Alinhamento Contratual
    "Você tem disponibilidade para início imediato caso seja aprovado(a)?",
    "Você concorda com os Termos de Uso e o tratamento dos seus dados conforme a LGPD?",
  ];

  console.log("🌱 Iniciando a seed de PerguntasEliminatorias...");

  const data = PerguntasEliminatorias.map((desc) => ({ descricao: desc }));

  await prisma.perguntaEliminatoria.createMany({
    data,
    skipDuplicates: true,
  });

  console.log("✅ Perguntas Eliminatorias cadastradas com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
