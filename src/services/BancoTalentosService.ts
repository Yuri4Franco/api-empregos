import type { TurnoPreferido } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export class BancoTalentosService {
  async listarVitrine(filtros: {
    id_area?: number | undefined;
    turno?: string | undefined;
    primeiro_emprego?: boolean | undefined;
    pcd?: boolean | undefined;
    pagina?: number | undefined;
    limite?: number | undefined;
  }) {
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 10;
    const skip = (pagina - 1) * limite;

    // 1. Regra de Ouro: SÓ busca quem quer ser visto
    const whereClause: any = {
      perfil_visivel_empresas: true,
      usuario: { status: "ATIVO" }, // Só listar candidatos com conta ativa
    };

    // 2. Filtros Dinâmicos
    if (filtros.id_area) {
      whereClause.areas_atuacao = {
        some: { id_area: filtros.id_area },
      };
    }
    
    if (filtros.turno) {
      whereClause.turno_preferido = filtros.turno as TurnoPreferido;
    }

    if (filtros.primeiro_emprego !== undefined) {
      whereClause.primeiro_emprego = filtros.primeiro_emprego;
    }

    if (filtros.pcd !== undefined) {
      whereClause.pcd = filtros.pcd;
    }

    // 3. Executa a busca paralela (Contagem + Dados)
    const [total, candidatos] = await Promise.all([
      prisma.candidato.count({ where: whereClause }),
      
      prisma.candidato.findMany({
        where: whereClause,
        skip,
        take: limite,
        orderBy: { usuario: { atualizado_em: "desc" } }, // Os perfis mais atualizados primeiro
        
        // 🚨 BLINDAGEM: Trazemos APENAS o que é público
        select: {
          id_usuario: true, // Precisamos para gerar o "Candidato #ID"
          objetivo_profissional: true,
          resumo_profissional: true,
          pretensao_salarial: true,
          turno_preferido: true,
          primeiro_emprego: true,
          pcd: true,
          
          // Cidade e Estado (É público, não identifica a rua da pessoa)
          endereco: {
            select: { cidade: true, uf: true }
          },
          
          // Áreas de atuação (para montar o título principal)
          areas_atuacao: {
            include: { area: { select: { nome: true } } }
          },

          // Experiências e Formações (Oculta contato das antigas empresas se tiver)
          experiencias: {
            select: { cargo: true, empresa: true, data_inicio: true, data_fim: true, atual: true }
          },
          formacoes: {
            select: { curso: true, nivel: true, instituicao: true }
          },
          competencias: {
            include: { competencia: { select: { nome: true } } }
          }
        }
      })
    ]);

    // 4. Formatação Final (A Máscara)
    const dadosMascarados = candidatos.map(c => {
      // Pega a principal área de atuação para colocar no título (ou um texto padrão)
      const areaPrincipal = c.areas_atuacao[0]?.area.nome || "Profissional";

      return {
        id_candidato: c.id_usuario, // Importante para a empresa poder clicar e desbloquear depois
        // ✨ A MÁGICA: "Candidato #1042 - Desenvolvedor Web"
        identificacao_publica: `Candidato #${c.id_usuario} - ${areaPrincipal}`,
        
        // Dados profissionais
        objetivo_profissional: c.objetivo_profissional,
        resumo_profissional: c.resumo_profissional,
        cidade: c.endereco?.cidade || "Não informada",
        uf: c.endereco?.uf || "--",
        turno_preferido: c.turno_preferido,
        primeiro_emprego: c.primeiro_emprego,
        pcd: c.pcd,
        
        // Arrays
        areas: c.areas_atuacao.map(a => a.area.nome),
        competencias: c.competencias.map(comp => comp.competencia.nome),
        experiencias: c.experiencias,
        formacoes: c.formacoes,
      };
    });

    return {
      dados: dadosMascarados,
      paginacao: {
        total,
        pagina_atual: pagina,
        total_paginas: Math.ceil(total / limite),
      }
    };
  }

  async obterCurriculo(id_candidato: number, id_empresa: number) {
    // 1. Busca os dados da empresa (para saber se é associada e o saldo de créditos)
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_curriculos: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // 2. Busca o currículo completo do candidato (mas blindando dados de senha)
    const candidato = await prisma.candidato.findUnique({
      where: { id_usuario: id_candidato },
      include: {
        usuario: { select: { nome: true, email: true, status: true } },
        endereco: true,
        areas_atuacao: { include: { area: { select: { nome: true } } } },
        experiencias: { orderBy: { data_inicio: "desc" } },
        formacoes: { orderBy: { data_conclusao: "desc" } },
        competencias: { include: { competencia: { select: { nome: true } } } },
      },
    });

    // 3. Regra de Segurança Básica: O candidato existe e quer ser visto?
    if (!candidato || !candidato.perfil_visivel_empresas || candidato.usuario.status !== "ATIVO") {
      throw new Error("Este currículo não está disponível no momento.");
    }

    // 4. A INTELIGÊNCIA DE ACESSO: Avalia se a empresa pode ver os dados
    let acessoLiberado = false;

    if (empresa.tipo_vinculo_aci === "ASSOCIADA") {
      acessoLiberado = true; // Sócio da ACI tem passe livre
    } else {
      // Se não é sócia, verifica se ela já "comprou" esse currículo no passado
      const jaDesbloqueou = await prisma.curriculoDesbloqueado.findUnique({
        where: {
          id_empresa_id_candidato: {
            id_empresa: id_empresa,
            id_candidato: id_candidato,
          },
        },
      });

      if (jaDesbloqueou) {
        acessoLiberado = true; // Já gastou crédito com ele, liberado para sempre!
      }
    }

    // 5. Monta o payload base (Os dados profissionais que todo mundo vê)
    const areaPrincipal = candidato.areas_atuacao[0]?.area.nome || "Profissional";
    const dadosProfissionais = {
      id_candidato: candidato.id_usuario,
      objetivo_profissional: candidato.objetivo_profissional,
      resumo_profissional: candidato.resumo_profissional,
      pretensao_salarial: candidato.pretensao_salarial,
      turno_preferido: candidato.turno_preferido,
      primeiro_emprego: candidato.primeiro_emprego,
      pcd: candidato.pcd,
      tipo_pcd: candidato.tipo_pcd,
      necessidade: candidato.necessidade,
      areas: candidato.areas_atuacao.map(a => a.area.nome),
      competencias: candidato.competencias.map(c => ({
        nome: c.competencia.nome,
        nivel: c.nivel
      })),
      experiencias: candidato.experiencias,
      formacoes: candidato.formacoes,
    };

    // 6. O BIFURCADOR: Retorna com base na permissão
    if (acessoLiberado) {
      // ✅ RETORNO COMPLETO (Dados Reais)
      return {
        acesso_liberado: true,
        perfil: {
          ...dadosProfissionais,
          // Revela os dados sensíveis:
          nome: candidato.usuario.nome,
          foto_url: candidato.foto_url,
          email: candidato.usuario.email,
          cpf: candidato.cpf,
          telefone: candidato.telefone,
          whatsapp: candidato.whatsapp,
          tipo_contato: candidato.tipo_contato,
          link_linkedin: candidato.link_linkedin,
          link_portfolio: candidato.link_portfolio,
          link_outro: candidato.link_outro,
          endereco_completo: candidato.endereco, 
        }
      };
    } else {
      // 🔒 RETORNO CENSURADO (Modo Vitrine)
      return {
        acesso_liberado: false,
        pode_desbloquear: true, // Avisa o Front-end para mostrar o botão de gastar crédito
        saldo_creditos_empresa: empresa.creditos_curriculos, // Manda o saldo para o frontend saber se mostra "Comprar" ou "Desbloquear"
        perfil: {
          ...dadosProfissionais,
          // Máscaras de proteção:
          nome: `Candidato #${candidato.id_usuario} - ${areaPrincipal}`,
          foto_url: null, // Esconde a foto
          email: "***@***.com",
          cpf: "***.***.***-**",
          telefone: "(**) *****-****",
          whatsapp: "(**) *****-****",
          tipo_contato: candidato.tipo_contato,
          link_linkedin: null,
          link_portfolio: null,
          link_outro: null,
          // Oculta rua/número, manda só Cidade/UF
          endereco_completo: {
            cidade: candidato.endereco?.cidade || "Não informada",
            uf: candidato.endereco?.uf || "--",
            bairro: candidato.endereco?.bairro || null,
          }
        }
      };
    }
  }

  async desbloquearCurriculoTransacao(id_candidato: number, id_empresa: number) {
    // 1. Validações Iniciais (Fora da transação para economizar processamento do banco)
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { tipo_vinculo_aci: true, creditos_curriculos: true },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");

    // Empresas associadas não precisam (e não devem) gastar créditos
    if (empresa.tipo_vinculo_aci === "ASSOCIADA") {
      throw new Error("Sua empresa é associada e já possui acesso ilimitado aos currículos.");
    }

    // Verifica se já não foi desbloqueado antes (evita duplo clique/cobrança dupla)
    const jaDesbloqueado = await prisma.curriculoDesbloqueado.findUnique({
      where: {
        id_empresa_id_candidato: {
          id_empresa: id_empresa,
          id_candidato: id_candidato,
        },
      },
    });

    if (jaDesbloqueado) {
      throw new Error("Este currículo já foi desbloqueado anteriormente pela sua empresa.");
    }

    // 2. A Regra de Negócio de Saldo (Gatilho para o 403)
    if (empresa.creditos_curriculos <= 0) {
      throw new Error("SALDO_INSUFICIENTE"); 
    }

    // 3. A Transação Financeira (Tudo ou Nada)
    await prisma.$transaction(async (tx) => {
      // Deduz 1 crédito do saldo da empresa
      await tx.empresa.update({
        where: { id_empresa },
        data: {
          creditos_curriculos: { decrement: 1 },
        },
      });

      // Registra o recibo de desbloqueio na tabela pivô
      await tx.curriculoDesbloqueado.create({
        data: {
          id_empresa: id_empresa,
          id_candidato: id_candidato,
        },
      });

      // Opcional mas recomendado: Registrar no Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_empresa, // ID de quem fez a ação
          entidade: "CANDIDATO",
          id_entidade: id_candidato,
          acao: "DESBLOQUEIO_CURRICULO_CREDITO",
          detalhes: { custo: 1, saldo_restante: empresa.creditos_curriculos - 1 }
        }
      });
    });

    // 4. O Gran Finale: Reutilizamos o método anterior!
    // Como o banco acabou de ser atualizado, o 'obterCurriculo' vai ler a tabela pivô,
    // ver que está liberado, e retornar o payload 100% completo e sem censuras.
    return await this.obterCurriculo(id_candidato, id_empresa);
  }


  async listarMeusDesbloqueados(id_empresa: number) {
    // Busca todos os registros de desbloqueio dessa empresa
    const historico = await prisma.curriculoDesbloqueado.findMany({
      where: { id_empresa },
      orderBy: { data_desbloqueio: "desc" }, // Os mais recentes no topo
      include: {
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true, status: true } },
            endereco: { select: { cidade: true, uf: true } },
            areas_atuacao: { include: { area: { select: { nome: true } } } },
            // Traz a última experiência só para dar contexto no Card
            experiencias: {
              orderBy: { data_inicio: "desc" },
              take: 1,
              select: { cargo: true, empresa: true }
            }
          }
        }
      }
    });

    // Formata para o Front-end não ter que lidar com aninhamento complexo
    const gaveta = historico.map(registro => {
      const c = registro.candidato;
      const areaPrincipal = c.areas_atuacao[0]?.area.nome || "Profissional";
      const ultimaExp = c.experiencias[0] ? `${c.experiencias[0].cargo} na ${c.experiencias[0].empresa}` : "Sem experiência registrada";

      return {
        id_candidato: c.id_usuario,
        data_desbloqueio: registro.data_desbloqueio,
        
        // Dados Liberados
        nome: c.usuario.nome,
        email: c.usuario.email,
        foto_url: c.foto_url,
        whatsapp: c.whatsapp,
        telefone: c.telefone,
        link_linkedin: c.link_linkedin,
        
        // Resumo Profissional
        area_principal: areaPrincipal,
        cidade: c.endereco?.cidade || "Não informada",
        uf: c.endereco?.uf || "--",
        ultima_experiencia: ultimaExp,
        
        // Flag para o Front-end saber se o cara pausou a conta depois que a empresa comprou
        perfil_ativo: c.usuario.status === "ATIVO" && c.perfil_visivel_empresas
      };
    });

    return gaveta;
  }

  async listarAreasComContagem() {

    const areas = await prisma.areaAtuacao.findMany({
      orderBy: { nome: "asc" },
      select: {
        id_area: true,
        nome: true,
        _count: {
          select: {
            candidatos: {
              where: {
                candidato: {
                  perfil_visivel_empresas: true,
                  usuario: { status: "ATIVO" } // Conta só quem está com a conta em dia
                }
              }
            }
          }
        }
      }
    });

    return areas.map(area => ({
      id_area: area.id_area,
      nome: area.nome,
      total_candidatos: area._count.candidatos
    }));
  }

  // 1. Alternar Favorito (Salvar / Remover)
  async alternarCurriculoSalvo(id_candidato: number, id_empresa: number, observacoes?: string) {
    const salvoExistente = await prisma.curriculoSalvo.findUnique({
      where: {
        id_empresa_id_candidato: { id_empresa, id_candidato }
      }
    });

    if (salvoExistente) {
      // Se já estava salvo, removemos (Unfavorite)
      await prisma.curriculoSalvo.delete({
        where: { id_salvo: salvoExistente.id_salvo }
      });
      return { favoritado: false, mensagem: "Currículo removido dos salvos." };
    } else {
      // Se não estava, nós salvamos
await prisma.curriculoSalvo.create({
        data: { 
          id_empresa: id_empresa, 
          id_candidato: id_candidato, 
          observacoes: observacoes ?? null 
        }
      });
      return { favoritado: true, mensagem: "Currículo salvo com sucesso!" };
    }
  }

  // 2. Listar Favoritos (Com filtro de censura embutido)
  async listarCurriculosSalvos(id_empresa: number) {
    // Busca os dados da empresa e a lista de quem ela já PAGOU para ver
    const [empresa, desbloqueios] = await Promise.all([
      prisma.empresa.findUnique({ where: { id_empresa }, select: { tipo_vinculo_aci: true } }),
      prisma.curriculoDesbloqueado.findMany({ where: { id_empresa }, select: { id_candidato: true } })
    ]);

    if (!empresa) throw new Error("Empresa não encontrada.");

    // Array rápido só com os IDs de quem está liberado
    const idsLiberados = desbloqueios.map(d => d.id_candidato);
    const isAssociada = empresa.tipo_vinculo_aci === "ASSOCIADA";

    // Busca a lista de favoritos
    const favoritos = await prisma.curriculoSalvo.findMany({
      where: { id_empresa },
      orderBy: { criado_em: "desc" },
      include: {
        candidato: {
          include: {
            usuario: { select: { nome: true, email: true, status: true } },
            endereco: { select: { cidade: true, uf: true } },
            areas_atuacao: { include: { area: { select: { nome: true } } } },
            experiencias: { orderBy: { data_inicio: "desc" }, take: 1, select: { cargo: true, empresa: true } }
          }
        }
      }
    });

    // Formata a resposta aplicando a regra de censura
    return favoritos.map(fav => {
      const c = fav.candidato;
      const areaPrincipal = c.areas_atuacao[0]?.area.nome || "Profissional";
      const ultimaExp = c.experiencias[0] ? `${c.experiencias[0].cargo} na ${c.experiencias[0].empresa}` : "Sem experiência registrada";
      
      // A MÁGICA DA SEGURANÇA: Tem acesso liberado?
      const acessoLiberado = isAssociada || idsLiberados.includes(c.id_usuario);

      const payloadBase = {
        id_candidato: c.id_usuario,
        data_salvo: fav.criado_em,
        observacoes_empresa: fav.observacoes, // A anotação que ela fez
        area_principal: areaPrincipal,
        ultima_experiencia: ultimaExp,
        acesso_liberado: acessoLiberado
      };

      if (acessoLiberado) {
        return {
          ...payloadBase,
          nome: c.usuario.nome,
          email: c.usuario.email,
          foto_url: c.foto_url,
          telefone: c.telefone,
          whatsapp: c.whatsapp,
          cidade: c.endereco?.cidade || "Não informada",
          uf: c.endereco?.uf || "--",
        };
      } else {
        return {
          ...payloadBase,
          nome: `Candidato #${c.id_usuario} - ${areaPrincipal}`,
          email: "***@***.com",
          foto_url: null,
          telefone: "(**) *****-****",
          whatsapp: "(**) *****-****",
          cidade: c.endereco?.cidade || "Não informada",
          uf: c.endereco?.uf || "--",
        };
      }
    });
  }
}