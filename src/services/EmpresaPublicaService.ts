import { prisma } from "../config/prisma.js";

export class EmpresaPublicaService {
  async buscarPerfilPublico(slug: string) {
    const empresa = await prisma.empresa.findUnique({
      where: { slug },
      // Usamos SELECT em vez de INCLUDE para blindar dados sensíveis
      select: {
        id_empresa: true,
        nome_fantasia: true,
        logotipo_url: true,
        banner_url: true,
        quem_somos: true,
        site: true,
        instagram: true,
        linkedin: true,
        facebook: true,
        
        // Do endereço, enviamos apenas dados de localização geral (sem rua/número)
        endereco: {
          select: {
            cidade: true,
            uf: true,
            bairro: true,
          },
        },

        // Pegamos os benefícios oferecidos
        beneficios_padrao: {
          select: {
            beneficio: {
              select: {
                id_beneficio: true,
                descricao: true,
              },
            },
          },
        },

        // Vitrine de Vagas: APENAS vagas ativas e com dados resumidos
        vagas: {
          where: { status: "ATIVA", empresa_confidencial: false },
          orderBy: { data_publicacao: "desc" },
          select: {
            id_vaga: true,
            titulo: true,
            modelo_trabalho: true,
            tipo_contrato: true,
            data_publicacao: true,
            tipo_diversidade: true,
            endereco: {
              select: { cidade: true, uf: true }
            }
          },
        },
      },
    });

    if (!empresa) {
      throw new Error("Página da empresa não encontrada.");
    }

    // Achatamos o array de benefícios para o Front-end receber uma lista limpa
    // Em vez de [{ beneficio: { descricao: "VT" } }], ele recebe [{ descricao: "VT" }]
    const perfilFormatado = {
      ...empresa,
      beneficios: empresa.beneficios_padrao.map((b) => b.beneficio),
      beneficios_padrao: undefined, // Remove a chave suja
    };

    return perfilFormatado;
  }
}