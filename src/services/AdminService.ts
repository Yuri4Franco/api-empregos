import { prisma } from "../config/prisma.js";
import argon2 from "argon2";
import { BaseUserService } from "./BaseUserService";

const baseUser = new BaseUserService();

export class AdminService {
  /** #region GESTÃO DE EMPRESAS:
   *
   *
   * Funcionalidades
   * - Cadastrar nova empresa
   * - Listar todas as empresas
   * - Obter detalhes de uma empresa específica
   * - Desativar empresa
   * - Atualizar dados de uma empresa
   *
   */

  // Cadastrar nova empresa + primeiro usuário vinculado
  async cadastrarEmpresa(dados: any, id_autor: number) {
    const cnpjLimpo = dados.cnpj.replace(/\D/g, "");

    // 1. Validações de unicidade fora da transaction principal para performance
    const eExistente = await prisma.empresa.findUnique({
      where: { cnpj: cnpjLimpo },
    });
    const uExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });

    if (eExistente) throw new Error("CNPJ já cadastrado.");
    if (uExistente) throw new Error("E-mail de usuário já cadastrado.");

    const senha_hash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {

      const endereco = await tx.endereco.create({
        data: {
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento || null,
          cep: dados.cep,
          cidade: dados.cidade || "Panambi",
          uf: dados.uf || "RS",
          bairro: dados.bairro,
        },
      });

      const empresa = await tx.empresa.create({
        data: {
          cnpj: cnpjLimpo,
          razao_social: dados.razao_social,
          nome_fantasia: dados.nome_fantasia,
          email: dados.email_institucional || null,
          tipo_vinculo_aci: dados.tipo_vinculo_aci || "NAO_ASSOCIADA",
          id_endereco: endereco.id_endereco,
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash,
          tipo_usuario: "EMPRESA",
          status: "ATIVO",
          id_empresa: empresa.id_empresa,
          exigir_troca_senha: true,
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "CADASTRAR_EMPRESA",
        "Empresa",
        empresa.id_empresa,
        {
          razao_social: empresa.razao_social,
          vinculo: empresa.tipo_vinculo_aci,
        },
      );

      return { usuario, empresa };
    });
  }

  async editarEmpresa(id_empresa: number, dados: any, id_autor: number) {
    const empresaExistente = await prisma.empresa.findUnique({
      where: { id_empresa },
      select: { id_endereco: true, nome_fantasia: true },
    });

    if (!empresaExistente) throw new Error("Empresa não encontrada.");

    if (!empresaExistente.id_endereco) {
      throw new Error(
        "Esta empresa não possui um endereço vinculado para editar.",
      );
    }

    const idEnderecoValido: number = empresaExistente.id_endereco;

    return await prisma.$transaction(async (tx) => {
      // 1. Atualizar o Endereço
      await tx.endereco.update({
        where: { id_endereco: idEnderecoValido },
        data: {
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento || null,
          cep: dados.cep,
          cidade: dados.cidade,
          uf: dados.uf,
          bairro: dados.bairro,
        },
      });

      // 2. Atualizar a Empresa
      const empresaAtualizada = await tx.empresa.update({
        where: { id_empresa },
        data: {
          cnpj: dados.cnpj,
          razao_social: dados.razao_social,
          nome_fantasia: dados.nome_fantasia,
          email: dados.email_institucional || null,
          tipo_vinculo_aci: dados.tipo_vinculo_aci,
        },
      });

      // 3. Registrar Log de Auditoria (ACI Panambi)
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ATUALIZAR_EMPRESA",
          detalhes: `Dados da empresa ${empresaExistente.nome_fantasia} (ID: ${id_empresa}) atualizados pelo administrador.`,
          entidade: "EMPRESA",
          id_entidade: id_empresa,
        },
      });

      return empresaAtualizada;
    });
  }
  // Listar todas as empresas com dados básicos e número de vagas
  async listarTodasEmpresas(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    status?: "ATIVO" | "BLOQUEADO",
  ) {
    const skip = (pagina - 1) * limite;

    const onde: any = {};

    if (busca) {
      onde.OR = [
        { nome_fantasia: { contains: busca, mode: "insensitive" } },
        { cnpj: { contains: busca } },
        { razao_social: { contains: busca, mode: "insensitive" } },
      ];
    }

    if (status) {
      onde.status = status;
    }

    const [total, totalAssociadas, totalNaoAssociadas, empresas] =
      await Promise.all([
        prisma.empresa.count({ where: onde }),
        prisma.empresa.count({
          where: { ...onde, tipo_vinculo_aci: "ASSOCIADA" },
        }),
        prisma.empresa.count({
          where: { ...onde, tipo_vinculo_aci: "NAO_ASSOCIADA" },
        }),
        prisma.empresa.findMany({
          where: onde,
          skip,
          take: limite,
          select: {
            id_empresa: true,
            nome_fantasia: true,
            cnpj: true,
            tipo_vinculo_aci: true,
            status: true,
            endereco: {
              select: {
                cidade: true,
                uf: true,
                bairro: true,
              },
            },
            _count: { select: { vagas: true } },
            usuarios: {
              take: 1,
              select: {
                nome: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { nome_fantasia: "asc" },
        }),
      ]);

    const dataFormatada = empresas.map((e) => ({
      id_empresa: e.id_empresa,
      nome_fantasia: e.nome_fantasia,
      cnpj: e.cnpj,
      status: e.status,
      tipo_vinculo_aci: e.tipo_vinculo_aci,
      cidade: e.endereco?.cidade || "N/A",
      bairro: e.endereco?.bairro || "N/A", // Mapeado como string direta
      vagas_count: e._count.vagas,
      responsavel: e.usuarios[0] || null,
    }));

    return {
      meta: {
        total,
        pagina,
        limite,
        total_paginas: Math.ceil(total / limite),
        total_associadas: totalAssociadas,
        total_nao_associadas: totalNaoAssociadas,
      },
      data: dataFormatada,
    };
  }

  // Obter detalhes de uma empresa específica, incluindo usuários e vagas
  async buscarEmpresaPorId(id_empresa: number) {
    const empresa = await prisma.empresa.findUnique({
      where: { id_empresa },
      include: {
        usuarios: {
          select: {
            id_usuario: true,
            nome: true,
            email: true,
            status: true,
            ultimo_login: true,
          }, 
        },
        vagas: true,
        endereco: true,
        beneficios_padrao: { include: { beneficio: true } },
      },
    });

    if (!empresa) throw new Error("Empresa não encontrada.");
    return empresa;
  }

  // Desativar empresa: bloqueia usuários, pausa vagas e registra auditoria
  async alterarStatusEmpresa(
    id_empresa: number,
    acao: "ATIVAR" | "DESATIVAR",
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const novoStatus = acao === "ATIVAR" ? "ATIVO" : "BLOQUEADO";

      await tx.empresa.update({
        where: { id_empresa },
        data: { status: novoStatus },
      });

      // 1. Atualiza usuários em massa
      await tx.usuario.updateMany({
        where: { id_empresa },
        data: { status: novoStatus },
      });

      // 2. Regra de negócio: Se desativa a empresa, pausa as vagas
      if (acao === "DESATIVAR") {
        await tx.vaga.updateMany({
          where: { id_empresa, status: "ATIVA" },
          data: { status: "PAUSADA" },
        });
      }

      // 3. Usa o rastro de auditoria padronizado do BaseUserService
      await baseUser.registrarLog(
        tx,
        id_autor,
        `${acao}_EMPRESA`,
        "Empresa",
        id_empresa,
      );

      return { success: true };
    });
  }
  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE EMPRESAS

  /** #region GESTÃO DE USUÁRIOS:
   *
   *
   *  Funcionalidades
   * - Cadastrar usuário vinculado a empresa
   * - Atualizar dados do usuário
   * - Desativar/Ativar usuário (Toggle Status)
   * - Listar todos os usuários de empresa
   * - Ver detalhes de UM usuário específico com contexto total
   *
   *
   */

  // Cadastrar novo usuário vinculado a uma empresa já existente
  async cadastrarUsuarioEmEmpresa(
    id_empresa: number,
    dados: any,
    id_autor: number,
  ) {
    // 1. Validação de existência da empresa (Pode ser feita fora da transação para poupar recursos)
    const empresa = await prisma.empresa.findUnique({ where: { id_empresa } });
    if (!empresa) throw new Error("Empresa não encontrada.");

    // 2. Verificação de E-mail Único
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("Este e-mail já está cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {
      // 3. Criação do Usuário Colaborador
      const novoUsuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "EMPRESA",
          status: "ATIVO",
          id_empresa: id_empresa,
          exigir_troca_senha: true,
        },
      });

      // 4. Log padronizado via BaseUserService
      await baseUser.registrarLog(
        tx,
        id_autor,
        "CRIAR_USUARIO_EM_EMPRESA",
        "Usuario",
        novoUsuario.id_usuario,
        {
          empresa: empresa.nome_fantasia,
        },
      );

      return novoUsuario;
    });
  }

  // Atualizar dados do usuário (nome, email, senha)
  async atualizarUsuario(id_usuario: number, dados: any, id_autor: number) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuarioExistente) throw new Error("Usuário não encontrado.");

    // Monta o objeto dinamicamente
    const dataUpdate: any = {};

    if (dados.nome) dataUpdate.nome = dados.nome;
    if (dados.email) dataUpdate.email = dados.email;

    if (dados.senha) {
      dataUpdate.senha_hash = await argon2.hash(dados.senha);
    }

    // Verifica se há algo para atualizar para não dar erro no Prisma
    if (Object.keys(dataUpdate).length === 0) {
      throw new Error("Nenhum dado informado para atualização.");
    }

    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: dataUpdate,
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ATUALIZAR_USUARIO",
          entidade: "Usuario",
          id_entidade: id_usuario,
          detalhes: { campos_alterados: Object.keys(dataUpdate) }, // Usar dataUpdate aqui é mais preciso
        },
      });

      return usuario;
    });
  }

  // Listar todos os usuários de empresa com dados básicos e empresa vinculada
  async listarTodosUsuariosEmpresa(filtros: any) {
    const { page, limit, search, status } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      tipo_usuario: "EMPRESA",
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nome: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                {
                  empresa: {
                    nome_fantasia: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {},
      ],
    };

    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where: onde }),
      prisma.usuario.findMany({
        where: onde,
        skip,
        take: limit,
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          status: true,
          criado_em: true,
          empresa: {
            select: { nome_fantasia: true },
          },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: usuarios,
    };
  }

  // Listar todos os candidatos com dados básicos
  async listarTodosCandidatos(filtros: any) {
    const {
      page = 1,
      limit = 10,
      search,
      cidade,
      id_bairro,
      id_area_atuacao,
      status,
    } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      tipo_usuario: "CANDIDATO",
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nome: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { candidato: { cpf: { contains: search } } },
              ],
            }
          : {},
        cidade || id_bairro
          ? {
              candidato: {
                endereco: {
                  is: {
                    ...(cidade && {
                      cidade: { contains: cidade, mode: "insensitive" },
                    }),
                    ...(id_bairro && { id_bairro: Number(id_bairro) }),
                  },
                },
              },
            }
          : {},
        // ✨ ATUALIZAÇÃO DO FILTRO: Usa o "some" para buscar na nova relação N:M
        id_area_atuacao
          ? {
              candidato: {
                areas_atuacao: {
                  some: { id_area: Number(id_area_atuacao) },
                },
              },
            }
          : {},
      ],
    };

    const [total, candidatos] = await Promise.all([
      prisma.usuario.count({ where: onde }),
      prisma.usuario.findMany({
        where: onde,
        skip,
        take: Number(limit),
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          status: true,
          candidato: {
            select: {
              cpf: true,
              telefone: true,
              whatsapp: true,
              endereco: {
                select: {
                  cidade: true,
                  uf: true,
                  bairro: true,
                },
              },
              // ✨ ATUALIZAÇÃO DO SELECT: Trazemos a lista de áreas
              areas_atuacao: {
                include: { area: { select: { nome: true } } },
              },
              competencias: {
                include: { competencia: { select: { nome: true } } },
                take: 3,
              },
            },
          },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    // ✨ ATUALIZAÇÃO DA FORMATAÇÃO: Transforma o array em uma string separada por vírgula
    const dataFormatada = candidatos.map((u) => ({
      id_usuario: u.id_usuario,
      nome: u.nome,
      email: u.email,
      status: u.status,
      cpf: u.candidato?.cpf,
      telefone: u.candidato?.telefone,
      whatsapp: u.candidato?.whatsapp,
      cidade: u.candidato?.endereco?.cidade || "N/A",
      bairro: u.candidato?.endereco?.bairro || "Outro",
      // Mapeia e junta com vírgula. Se estiver vazio, exibe "Não definida"
      areas_atuacao: u.candidato?.areas_atuacao?.length
        ? u.candidato.areas_atuacao.map((a) => a.area.nome).join(", ")
        : "Não definida",
      competencias: u.candidato?.competencias.map((c) => c.competencia.nome),
    }));

    return {
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_paginas: Math.ceil(total / limit),
      },
      data: dataFormatada,
    };
  }

  // Ver currículo completo (Perfil + Experiências + Formações)
  async obterCurriculoCompleto(id_usuario: number) {
    const perfil = await prisma.usuario.findUnique({
      where: { id_usuario },
      include: {
        candidato: {
          include: {
            experiencias: {
              orderBy: { data_inicio: "desc" }, // Mais recentes primeiro
            },
            formacoes: {
              orderBy: { status: "asc" }, // Ou por data de conclusão
            },
            competencias: {
              include: {
                competencia: {
                  select: { nome: true }, // Traz o nome da skill (Ex: Excel)
                },
              },
            },
          },
        },
      },
    });

    // Validação de segurança
    if (!perfil || perfil.tipo_usuario !== "CANDIDATO") {
      throw new Error(
        "Candidato não encontrado ou usuário não é do tipo candidato.",
      );
    }

    // Removemos a senha por segurança, mesmo sendo rota de Admin
    const { senha_hash, ...dadosSeguros } = perfil;
    return dadosSeguros;
  }

  // Atualizar o currículo (Parte do Candidato)
  async atualizarPerfilCompletoCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Buscar o candidato atual
      const candidatoAtual = await tx.candidato.findUnique({
        where: { id_usuario },
        select: { id_endereco: true },
      });

      if (!candidatoAtual) throw new Error("Candidato não encontrado.");

      // 2. Atualizar dados básicos do Usuário
      if (dados.nome || dados.email) {
        await tx.usuario.update({
          where: { id_usuario },
          data: {
            nome: dados.nome,
            email: dados.email,
          },
        });
      }

      // 3. Atualizar Endereço (Lógica para evitar 'undefined' no update)
      if (candidatoAtual.id_endereco) {
        const enderecoData: any = {};
        if (dados.logradouro !== undefined)
          enderecoData.logradouro = dados.logradouro;
        if (dados.numero !== undefined) enderecoData.numero = dados.numero;
        if (dados.complemento !== undefined)
          enderecoData.complemento = dados.complemento;
        if (dados.cep !== undefined) enderecoData.cep = dados.cep;
        if (dados.cidade !== undefined)
          enderecoData.cidade = dados.cidade || "Panambi";
        if (dados.uf !== undefined) enderecoData.uf = dados.uf || "RS";
        if (dados.id_bairro) enderecoData.id_bairro = Number(dados.id_bairro);

        await tx.endereco.update({
          where: { id_endereco: candidatoAtual.id_endereco },
          data: enderecoData,
        });
      }

      // 4. Atualizar o Candidato (Construindo objeto de update limpo)
      const candidatoData: any = {};
      if (dados.cpf !== undefined)
        candidatoData.cpf = dados.cpf?.replace(/\D/g, "");
      if (dados.id_area_atuacao)
        candidatoData.id_area_atuacao = Number(dados.id_area_atuacao);
      if (dados.telefone !== undefined) candidatoData.telefone = dados.telefone;
      if (dados.whatsapp !== undefined) candidatoData.whatsapp = dados.whatsapp;
      if (dados.resumo_profissional !== undefined)
        candidatoData.resumo_profissional = dados.resumo_profissional;
      if (dados.objetivo_profissional !== undefined)
        candidatoData.objetivo_profissional = dados.objetivo_profissional;
      if (dados.pretensao_salarial !== undefined)
        candidatoData.pretensao_salarial = dados.pretensao_salarial;
      if (dados.genero !== undefined) candidatoData.genero = dados.genero;
      if (dados.pcd !== undefined) candidatoData.pcd = dados.pcd;
      if (dados.tipo_pcd !== undefined) candidatoData.tipo_pcd = dados.tipo_pcd;
      if (dados.data_nascimento)
        candidatoData.data_nascimento = new Date(dados.data_nascimento);

      const candidato = await tx.candidato.update({
        where: { id_usuario },
        data: candidatoData,
      });

      // 5. Sincronizar Experiências
      if (dados.experiencias && Array.isArray(dados.experiencias)) {
        await tx.experienciaProfissional.deleteMany({
          where: { id_candidato: id_usuario },
        });
        await tx.experienciaProfissional.createMany({
          data: dados.experiencias.map((exp: any) => ({
            id_candidato: id_usuario,
            empresa: exp.empresa,
            cargo: exp.cargo,
            atividades: exp.atividades,
            data_inicio: new Date(exp.data_inicio),
            data_fim: exp.data_fim ? new Date(exp.data_fim) : null,
            atual: exp.atual || false,
          })),
        });
      }

      // ... (restante dos métodos de Formação e Competência permanecem iguais, pois usam createMany/deleteMany)

      // 8. Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ADM_ATUALIZACAO_TOTAL_PERFIL",
          entidade: "Candidato",
          id_entidade: id_usuario,
          detalhes: { campos_atualizados: Object.keys(dados) },
        },
      });

      return candidato;
    });
  }

  // Cadastrar Candidato Manualmente
  async cadastrarCandidatoManual(dados: any, id_autor: number) {
    // 1. Verificações pré-transação
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("E-mail já cadastrado.");

    const cpfExistente = await prisma.candidato.findUnique({
      where: { cpf: dados.cpf },
    });
    if (cpfExistente) throw new Error("CPF já cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {
      // 2. Criar o Endereço (Trocando undefined por null)
      const endereco = await tx.endereco.create({
        data: {
          logradouro: dados.logradouro || null,
          numero: dados.numero || null,
          complemento: dados.complemento || null,
          cep: dados.cep || null,
          cidade: dados.cidade || "Panambi",
          uf: dados.uf || "RS",
          id_bairro: dados.id_bairro ? Number(dados.id_bairro) : null, // Use null, não undefined
        },
      });

      // 3. Criar o Usuário base
      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "CANDIDATO",
          status: "ATIVO",
          exigir_troca_senha: true,
        },
      });

      // 4. Cria o Perfil do Candidato (Trocando undefined por null)
      const candidato = await tx.candidato.create({
        data: {
          id_usuario: usuario.id_usuario,
          id_endereco: endereco.id_endereco,
          id_area_atuacao: dados.id_area_atuacao
            ? Number(dados.id_area_atuacao)
            : null, // Use null aqui também
          cpf: dados.cpf,
          telefone: dados.telefone || null,
          whatsapp: dados.whatsapp || null,
          data_nascimento: dados.data_nascimento
            ? new Date(dados.data_nascimento)
            : null,
          genero: dados.genero || null,
          pcd: dados.pcd ?? false,
          tipo_pcd: dados.tipo_pcd || null,
          perfil_visivel_empresas: true,
        },
      });

      // 5. Registro de Log
      await baseUser.registrarLog(
        tx,
        id_autor,
        "CADASTRAR_CANDIDATO_MANUAL",
        "Candidato",
        usuario.id_usuario,
        {
          nome: usuario.nome,
          cpf: dados.cpf,
        },
      );

      return { usuario, candidato };
    });
  }

  // Adicionar Experiência Profissional
  async adicionarExperienciaCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const experiencia = await tx.experienciaProfissional.create({
        data: {
          id_candidato: id_usuario,
          ...dados, // Zod já garantiu os campos e os tipos Date
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ADM_ADD_EXPERIENCIA",
        "Candidato",
        id_usuario,
        {
          cargo: dados.cargo,
          empresa: dados.empresa,
        },
      );

      return experiencia;
    });
  }

  // Adicionar Formação Acadêmica
  async adicionarFormacaoCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const formacao = await tx.formacaoAcademica.create({
        data: {
          id_candidato: id_usuario,
          ...dados, // Zod já cuidou de tudo
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ADM_ADD_FORMACAO",
        "Candidato",
        id_usuario,
        {
          curso: dados.curso,
          instituicao: dados.instituicao,
        },
      );

      return formacao;
    });
  }

  async adicionarCompetenciaCandidato(
    id_usuario: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const vinculo = await tx.candidatoCompetencia.upsert({
        where: {
          id_candidato_id_competencia: {
            id_candidato: id_usuario,
            id_competencia: dados.id_competencia,
          },
        },
        update: { nivel: dados.nivel },
        create: {
          id_candidato: id_usuario,
          id_competencia: dados.id_competencia,
          nivel: dados.nivel,
        },
        include: { competencia: true },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ADM_ADD_COMPETENCIA",
        "Candidato",
        id_usuario,
        {
          competencia: vinculo.competencia.nome,
          nivel: dados.nivel,
        },
      );

      return vinculo;
    });
  }

  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE USUÁRIOS

  /** #region GESTÃO DE ADMINISTRADORES:
   *
   *
   *
   * Funcionalidades:
   * - Cadastrar novo administrador (Master ou ADM comum)
   * - Listar apenas os administradores
   * - Deletar administrador
   *
   *
   */

  // Cadastrar novo administrador (Master ou ADM comum)
  async cadastrarNovoAdmin(dados: any, id_autor: number) {
    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (emailExistente) throw new Error("E-mail já cadastrado.");

    const senhaHash = await argon2.hash(dados.senha);

    return await prisma.$transaction(async (tx) => {
      const novoAdmin = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senha_hash: senhaHash,
          tipo_usuario: "ADM",
          status: "ATIVO",
          is_master: dados.is_master || false,
          id_empresa: dados.id_empresa,
        },
      });

      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "CADASTRAR_ADMINISTRADOR",
          entidade: "Usuario",
          id_entidade: novoAdmin.id_usuario,
          detalhes: { nome: novoAdmin.nome, is_master: novoAdmin.is_master },
        },
      });

      return novoAdmin;
    });
  }

  // Listar apenas os administradores
  async listarAdministradores(filtros: any) {
    const { page = 1, limit = 10, search, status } = filtros;
    const skip = (page - 1) * limit;

    const onde: any = {
      tipo_usuario: "ADM",
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nome: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const [total, admins] = await Promise.all([
      prisma.usuario.count({ where: onde }),
      prisma.usuario.findMany({
        where: onde,
        skip,
        take: limit,
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          status: true,
          is_master: true,
          ultimo_login: true,
          criado_em: true,
        },
        orderBy: { nome: "asc" },
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
        total_paginas: Math.ceil(total / limit),
      },
      data: admins,
    };
  }

  async atualizarDadosAdmin(id_admin: number, dados: any, id_autor: number) {
    const senha_hash = dados.senha ? await argon2.hash(dados.senha) : undefined;

    return await prisma.$transaction(async (tx) => {
      const admin = await tx.usuario.update({
        where: { id_usuario: id_admin },
        data: {
          nome: dados.nome,
          email: dados.email,
          status: dados.status,
          is_master: dados.is_master,
          ...(senha_hash && {
            senha_hash,
            exigir_troca_senha: true,
          }),
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "ATUALIZAR_ADMINISTRADOR",
        "Usuario",
        id_admin,
        {
          campos_alterados: Object.keys(dados).filter((k) => k !== "senha"),
        },
      );

      return admin;
    });
  }

  async forcarTrocaSenha(
    id_usuario: number,
    novaSenhaPura: string,
    id_autor: number,
  ) {
    const senha_hash = await argon2.hash(novaSenhaPura);

    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id_usuario },
        data: {
          senha_hash,
          exigir_troca_senha: true,
        },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        "FORCAR_TROCA_SENHA",
        "Usuario",
        id_usuario,
      );

      // Opcional: Aqui dispararia o EmailService no futuro
      return usuario;
    });
  }
  // #endregion FIM DAS FUNCIONALIDADES DE GESTÃO DE ADMINISTRADORES

  //gerenciar crédito das empresas

  async gerenciarCreditosEmpresa(
    id_empresa: number,
    dados: any,
    id_autor: number,
  ) {
    // 1. Busca inicial para validar existência e ter os valores atuais para o log
    const empresa = await prisma.empresa.findUnique({ where: { id_empresa } });
    if (!empresa) throw new Error("Empresa não encontrada.");

    return await prisma.$transaction(async (tx) => {
      const novaData: any = {};

      // Lógica para Vagas
      if (dados.creditos_vagas !== undefined) {
        novaData.creditos_vagas =
          dados.modo === "SOMAR"
            ? empresa.creditos_vagas + Number(dados.creditos_vagas)
            : Number(dados.creditos_vagas);
      }

      // Lógica para Currículos (Pacotes de visualização) [cite: 36]
      if (dados.creditos_curriculos !== undefined) {
        novaData.creditos_curriculos =
          dados.modo === "SOMAR"
            ? empresa.creditos_curriculos + Number(dados.creditos_curriculos)
            : Number(dados.creditos_curriculos);
      }

      // Proteção contra objeto vazio
      if (Object.keys(novaData).length === 0) {
        throw new Error(
          "Informe a quantidade de créditos de vagas ou currículos.",
        );
      }

      const empresaAtualizada = await tx.empresa.update({
        where: { id_empresa },
        data: novaData,
      });

      // 2. Registro de Auditoria (Escopo: Histórico de ações críticas [cite: 56, 58])
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: "ATUALIZAR_CREDITOS_EMPRESA",
          entidade: "Empresa",
          id_entidade: id_empresa,
          detalhes: {
            antes: {
              v: empresa.creditos_vagas,
              c: empresa.creditos_curriculos,
            },
            depois: {
              v: empresaAtualizada.creditos_vagas,
              c: empresaAtualizada.creditos_curriculos,
            },
            modo: dados.modo,
          },
        },
      });

      return empresaAtualizada;
    });
  }
  async listarRelatosOuvidoria(filtros: any) {
    const { page = 1, limit = 10 } = filtros;
    const skip = (page - 1) * limit;

    const [total, relatos] = await Promise.all([
      prisma.ouvidoriaRelato.count(),
      prisma.ouvidoriaRelato.findMany({
        skip,
        take: limit,
        include: {
          candidato: {
            select: {
              usuario: { select: { nome: true, email: true } },
            },
          },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: relatos,
    };
  }

  // --- SEÇÃO DE SUPORTE (TICKETS) ---
  async listarTicketsSuporte(filtros: any) {
    const { page = 1, limit = 10, status } = filtros;
    const skip = (page - 1) * limit;

    const onde = status ? { status } : {};

    const [total, tickets] = await Promise.all([
      prisma.ticketSuporte.count({ where: onde }),
      prisma.ticketSuporte.findMany({
        where: onde,
        skip,
        take: limit,
        include: {
          usuario: { select: { nome: true, email: true, tipo_usuario: true } },
        },
        orderBy: { criado_em: "desc" },
      }),
    ]);

    return {
      meta: { total, page, limit, total_paginas: Math.ceil(total / limit) },
      data: tickets,
    };
  }

  async atualizarStatusTicket(
    id_ticket: number,
    novoStatus: string,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticketSuporte.update({
        where: { id_ticket },
        data: { status: novoStatus },
      });

      await baseUser.registrarLog(
        tx,
        id_autor,
        `ATUALIZAR_STATUS_TICKET_${novoStatus}`,
        "TicketSuporte",
        id_ticket,
      );

      return ticket;
    });
  }

  async liberarRecursosPagos(
    id_empresa: number,
    dados: { tipo: "VAGA" | "CURRICULO"; quantidade: number },
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verificar se a empresa existe
      const empresa = await tx.empresa.findUnique({ where: { id_empresa } });
      if (!empresa) throw new Error("Empresa não encontrada.");

      // 2. Atualizar o saldo de créditos conforme o tipo
      const updateData =
        dados.tipo === "VAGA"
          ? { creditos_vagas: { increment: dados.quantidade } }
          : { creditos_curriculos: { increment: dados.quantidade } };

      const empresaAtualizada = await tx.empresa.update({
        where: { id_empresa },
        data: updateData,
      });

      // 3. Registrar Log de Auditoria Crítica [cite: 58]
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: `LIBERACAO_MANUAL_${dados.tipo}`,
          entidade: "Empresa",
          id_entidade: id_empresa,
          detalhes: {
            quantidade: dados.quantidade,
            motivo: "Confirmação manual de pagamento (Balcão/Transferência)",
          },
        },
      });

      return empresaAtualizada;
    });
  }

  //gestão de marketing
  async listarPedidosAdmin(status?: any) {
    return await prisma.solicitacaoMidia.findMany({
      where: status ? { status } : {},
      include: {
        empresa: { select: { nome_fantasia: true } },
        vaga: { select: { titulo: true, status: true } },
      },
      orderBy: { criado_em: "asc" },
    });
  }

  async atualizarStatusPedido(
    id_solicitacao: number,
    dados: any,
    id_autor: number,
  ) {
    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.solicitacaoMidia.update({
        where: { id_solicitacao },
        data: {
          status: dados.status,
          justificativa: dados.justificativa,
        },
      });

      // Log de Auditoria
      await tx.logAuditoria.create({
        data: {
          id_usuario: id_autor,
          acao: `MIDIA_STATUS_${dados.status}`,
          entidade: "SolicitacaoMidia",
          id_entidade: id_solicitacao,
          detalhes: {
            status: dados.status,
            justificativa: dados.justificativa,
          },
        },
      });

      return pedido;
    });
  }
}
