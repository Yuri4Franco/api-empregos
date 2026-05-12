import { prisma } from '../src/config/prisma';


async function main() {
const AreasDeAtuacao = [
  'Indústria Metal-Mecânica',
  'Máquinas e Implementos Agrícolas',
  'Agronegócio',
  'Cooperativismo',
  'Tecnologia da Informação',
  'Logística e Transporte',
  'Manutenção Industrial',
  'Construção Civil',
  'Comércio Varejista',
  'Saúde e Bem-estar',
  'Educação',
  'Gastronomia',
  'Marketing e Comunicação',
  'Contabilidade e Finanças',
  'Consultoria Jurídica',
  'Estética e Cosmética',
  'Segurança e Vigilância',
  'Energia e Sustentabilidade',
  'Turismo e Hotelaria',
  'Recursos Humanos',
  'Operador de Máquinas CNC',
  'Soldador TIG/MIG',
  'Auxiliar de Produção',
  'Torneiro Mecânico',
  'Montador Industrial',
  'Mecânico de Manutenção',
  'Pintor Industrial',
  'Eletricista Industrial',
  'Operador de Empilhadeira',
  'Almoxarife',
  'Auxiliar de Logística',
  'Motorista de Caminhão (Categoria D/E)',
  'Operador de Máquinas Agrícolas',
  'Técnico em Segurança do Trabalho',
  'Técnico em Eletromecânica',
  'Técnico em Edificações',
  'Frezador',
  'Caldeireiro',
  'Pedreiro',
  'Marceneiro'
];

  console.log('🌱 Iniciando a seed de AreasDeAtuacao...');

  for (const item of AreasDeAtuacao) {
    await prisma.areaAtuacao.upsert({
      // Usamos a descricao como identificador único para o upsert
      where: { nome: item }, 
      update: {}, 
      create: {
        nome: item,
      },
    });
  }

  console.log('✅ Áreas de Atuação cadastradas com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });