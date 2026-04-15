import { prisma } from '../src/config/prisma';


async function main() {
  const beneficiosPadrao = [
    "Vale Alimentação",
    "Vale Refeição",
    "Vale Transporte",
    "Plano de Saúde",
    "Plano Odontológico",
    "Seguro de Vida",
    "Auxílio Educação",
    "Participação nos Lucros (PLR)",
    "Home Office",
    "Gympass",
    "Cesta Básica",
    "Horário Flexível",
    "Auxílio Creche",
    "Day-off no Aniversário",
    "Auxílio Educação",
    "Auxílio Mestrado",
    "Apoio Psicológico",
    "Auxílio Combustível",
    "Auxílio óculos",
    "Restaurante na Empresa",
    "Programa de Plano de Carreira",
    "Auxílio Farmacêutico",
    "Associação Recreativa",
    "Biblioteca",
    "Cafeteria Interna",
    "Estacionamento Gratuito",
    "Auxílio Idiomas"
  ];

  console.log('🌱 Iniciando a seed de benefícios...');

  for (const item of beneficiosPadrao) {
    await prisma.beneficio.upsert({
      // Usamos a descricao como identificador único para o upsert
      where: { descricao: item }, 
      update: {}, 
      create: {
        descricao: item,
      },
    });
  }

  console.log('✅ Benefícios cadastrados com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });