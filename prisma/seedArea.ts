import { prisma } from '../src/config/prisma';


async function main() {
const AreasDeAtuacao = [
  'Jovem Aprendiz',
'Estágio',
'Auxiliar Administrativo / Escritório',
'Auxiliar de Produção e Montagem',
'Serviços Gerais e Limpeza',
'Auxiliar de Manutenção',
'Engenharia Mecânica e de Produção',
'Usinagem (Torno, Fresa e Ferramentaria)',
'Programação e Operação CNC',
'Soldagem (MIG/MAG, TIG, Eletrodo) e Inspeção',
'Caldeiraria, Traçagem e Estamparia',
'Montagem Industrial e de Máquinas',
'Manutenção Mecânica e Industrial',
'Manutenção Elétrica e Eletrotécnica',
'Operação de Corte, Dobra e Prensas',
'Operação de Máquinas Industriais / Ponte Rolante',
'Injeção Plástica e Polímeros',
'Pintura Industrial e Tratamento de Superfícies',
'Qualidade, Metrologia e Inspeção',
'Segurança do Trabalho e Ergonomia',
'Automação e Controle Industrial',
'PCP (Planejamento e Controle de Produção)',
'Almoxarifado, Estoque e Logística Interna',
'Gestão de Frota e Roteirização',
'Carga, Descarga e Operação de Empilhadeira',
'Compras, Suprimentos e Licitações',
'Motorista Linha Leve e Entregas (CNH A/B)',
'Motorista Linha Pesada (Truck / Carreta CNH C/D/E)',
'Tratorista / Operador de Máquina Pesada',
'Agronomia, Zootecnia e Veterinária',
'Técnico Agrícola e Gestão do Agronegócio',
'Mecânica e Montagem Agrícola (Máquinas e Silos)',
'Armazenagem de Grãos (Secador/Classificador)',
'Trabalho de Campo e Capatazia',
'Vendas Varejo, Balcão e Operação de Caixa',
'Vendas Atacado e B2B',
'Vendas Técnicas / Engenharia de Vendas',
'Representação Comercial',
'Atendimento, Recepção e SAC',
'Promotor de Vendas e Reposição',
'Atendente de Farmácia',
'E-commerce, Telemarketing e Vendas Online',
'Administração Geral e Planejamento',
'Recursos Humanos (RH) e Departamento Pessoal (DP)',
'Contabilidade, Gestão Fiscal e Tributária',
'Financeiro, Faturamento e Cobrança',
'Secretariado Executivo',
'Jurídico, Advocacia e Compliance',
'Desenvolvimento de Software (Dev)',
'Implantação e Suporte de Sistemas (ERP)',
'Infraestrutura, Redes e Suporte Técnico',
'Análise de Dados, BI e Banco de Dados ',
'Design de Interfaces (UI/UX) e Web Design' ,
'Inovação',
'Arquitetura e Engenharia Civil',
'Mestre de Obras e Construção Civil Geral',
'Manutenção Predial (Eletricista, Encanador, Pintor, etc)',
'Corretagem de Imóveis / Setor Imobiliário',
'Cozinha Profissional (Chef, Cozinheiro, Auxiliar)',
'Atendimento em Restaurantes (Garçom, Chapeiro)',
'Recepção e Atendimento Hoteleiro',
'Organização de Eventos, Fotografia e Audiovisual',
'Costura e Confecção',
'Marcenaria, Serralheria e Vidraçaria',
'Estofaria e Tapeçaria',
'Refrigeração, Climatização e Ar Condicionado',
'Serviços Domésticos e Cuidados Pessoais',
'Portaria e Segurança Patrimonial',
'Medicina, Odontologia e Especialidades',
'Enfermagem e Técnicos de Saúde',
'Fisioterapia, Nutrição e Psicologia',
'Farmácia (Bioquímica e Responsabilidade Técnica)',
'Estética, Salão de Beleza e Barbearia',
'Educação Física e Esportes',
'Ensino, Pedagogia e Orientação Educacional',
'Marketing, Design Gráfico e Redes Sociais',
'Publicidade, Jornalismo e Assessoria',
'Mecânica Automotiva (Leve e Pesada)',
'Chapeação, Pintura e Estética Automotiva',
'Serviços Automotivos (Geometria, Borracharia, Autopeças)',
'Diretoria e C-Level',
'Gerência e Supervisão de Indústria/Produção',
'Gerência e Supervisão Comercial/Varejo',
'Gerência Administrativa, RH e Financeira',
'Liderança de Linha de Produção',
'Liderança Agrícola, Frota e Logística',
'Gerência de TI e Projetos',
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