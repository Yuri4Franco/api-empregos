import type { Request, Response } from "express";
import { AdminService } from "../services/AdminService.js";
import { BaseUserService } from "../services/BaseUserService.js";

import { EmpresaSchema, QueryListagemSchema } from "../schemas/auth.schema.js";
import { z } from "zod";

const adminService = new AdminService();
const baseUserService = new BaseUserService();

export class AdminController {
  /** #region GESTÃO DE EMPRESAS:
   *  Funcionalidades:
   * - Cadastrar empresa
   * - Listar todas
   * - Obter detalhes
   * - Desativar empresa
   * */

  // Cadastrar nova empresa e o usuário administrador dela -revisada-
  async cadastrarEmpresa(req: Request, res: Response) {
    try {
      const id_autor = req.user.id;
      const resultado = await adminService.cadastrarEmpresa(req.body, id_autor);
      return res.status(201).json(resultado);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Listar todas as empresas cadastradas -revisada-
  async listarEmpresas(req: Request, res: Response) {
    try {
      // O .parse valida e já transforma as strings em números conforme o schema
      const { page, limit, search } = QueryListagemSchema.parse(req.query);

      const result = await adminService.listarTodasEmpresas(
        page,
        limit,
        search,
      );

      return res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Parâmetros de consulta inválidos",
          detalhes: error.issues,
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Buscar detalhes de uma empresa específica por ID
  async obterDetalhesEmpresa(req: Request, res: Response) {
    try {
      // O id já vem como number aqui graças ao z.coerce do middleware
      const { id } = req.params as unknown as { id: number };

      const empresa = await adminService.buscarEmpresaPorId(id);

      return res.status(200).json(empresa);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // Bloquear uma empresa e pausar suas vagas (soft delete)
  async alterarStatusEmpresa(req: Request, res: Response) {
    try {
      const { id } = req.params as unknown as { id: number };
      const { acao } = req.body;
      const id_autor = req.user.id;

      await adminService.alterarStatusEmpresa(id, acao, id_autor);

      return res.status(200).json({
        message:
          acao === "ATIVAR"
            ? "Acesso da empresa e usuários restaurado."
            : "Empresa desativada: usuários bloqueados e vagas pausadas.",
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // #endregion FIM DA GESTÃO DE EMPRESAS

  /** #region GESTÃO DE USUÁRIOS (COLABORADORES):
   * Funcionalidades:
   * - Adicionar novo acesso
   * - Atualizar dados
   * - Ativar/Bloquear usuário
   * - Listagem e detalhes
   * */

  // Adicionar um novo colaborador a uma empresa já existente
  async cadastrarUsuarioEmEmpresa(req: Request, res: Response) {
    try {
      const { id } = req.params as unknown as { id: number };
      const id_autor = req.user.id;

      const usuario = await adminService.cadastrarUsuarioEmEmpresa(
        id,
        req.body,
        id_autor,
      );

      // Ocultamos o hash da senha no retorno por segurança
      const { senha_hash, ...dadosPublicos } = usuario;

      return res.status(201).json(dadosPublicos);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Atualizar nome, e-mail ou senha de um usuário empresa
  async atualizarUsuario(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as unknown as { id_usuario: number };
      const idAutor = req.user.id;

      // Chamamos a função do Base
      const usuario = await baseUserService.atualizarUsuario(
        id_usuario,
        req.body,
        idAutor,
      );

      return res.status(200).json({
        message: "Dados do usuário atualizados.",
        data: {
          id_usuario: usuario.id_usuario,
          nome: usuario.nome,
          email: usuario.email,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Bloquear ou ativar um acesso individual
  async alternarStatusUsuario(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as unknown as { id_usuario: number };
      const { status } = req.body;
      const idAutor = req.user.id;

      // Chamamos direto do baseUserService que o AdminService já possui/conhece
      await baseUserService.alterarStatus(id_usuario, status, idAutor);

      return res.status(200).json({
        message: `Usuário ${status === "ATIVO" ? "ativado" : "bloqueado"} com sucesso.`,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Listar todos os usuários do tipo EMPRESA no sistema
  async listarUsuariosEmpresa(req: Request, res: Response) {
    try {
      // req.query já está limpo e tipado pelo Zod
      const result = await adminService.listarTodosUsuariosEmpresa(req.query);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
  // Obter detalhes completos de um usuário (incluindo logs e empresa)
  async obterDetalhesUsuario(req: Request, res: Response) {
    try {
      // Pegamos o ID já validado e convertido para número pelo Zod
      const { id_usuario } = req.params as any;

      const usuario = await baseUserService.buscarPorId(id_usuario);

      return res.status(200).json(usuario);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  async cadastrarCandidatoManual(req: Request, res: Response) {
    try {
      const idAutor = req.user.id;
      // O req.body já chega 100% validado e tipado
      const resultado = await adminService.cadastrarCandidatoManual(
        req.body,
        idAutor,
      );

      return res.status(201).json({
        message: "Candidato cadastrado com sucesso.",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Listar todos os usuários candidato
  async listarCandidatos(req: Request, res: Response) {
    try {
      const filtros = req.query;

      const result = await adminService.listarTodosCandidatos(filtros);

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Ver currículo completo do candidato
  async obterCurriculo(req: Request, res: Response) {
    try {
      // Pegamos o id já validado e convertido pelo middleware
      const { id } = req.params as any;

      const curriculo = await adminService.obterCurriculoCompleto(id);

      return res.status(200).json(curriculo);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // Atualizar currículo/perfil pelo ADM
  async atualizarPerfilCompleto(req: Request, res: Response) {
    try {
      // O id já vem como number pelo middleware validate(IdParamSchema, 'params')
      const { id } = req.params as any;
      const id_autor = req.user.id;

      // req.body já está validado e com as datas convertidas
      const resultado = await adminService.atualizarPerfilCompletoCandidato(
        id,
        req.body,
        id_autor,
      );

      return res.status(200).json({
        message: "Perfil atualizado com sucesso!",
        data: resultado,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // Resetar senha de qualquer usuário (Forçar troca)
  async resetarSenhaUsuario(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params;
      const { novaSenha } = req.body;
      const idAutor = req.user.id;

      if (!novaSenha) throw new Error("A nova senha deve ser fornecida.");

      await adminService.forcarTrocaSenha(
        Number(id_usuario),
        novaSenha,
        idAutor,
      );

      return res.status(200).json({
        success: true,
        message: "Senha alterada. O usuário deverá trocar no próximo login.",
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  // #endregion FIM DA GESTÃO DE USUÁRIOS (COLABORADORES)

  /** #region GESTÃO DE EQUIPE ACI (MASTER):
   * Funcionalidades:
   * - Criar outros administradores
   * - Visualizar equipe ACI
   * */

  async cadastrarNovoAdmin(req: Request, res: Response) {
    try {
      if (!req.user.master)
        return res.status(403).json({ message: "Acesso restrito ao Master." });
      const admin = await adminService.cadastrarNovoAdmin(
        req.body,
        req.user.id,
      );
      return res.status(201).json({ success: true, data: admin });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async listarAdmins(req: Request, res: Response) {
    try {
      if (!req.user.master)
        return res.status(403).json({ message: "Acesso restrito ao Master." });
      const admins = await adminService.listarAdministradores();
      return res.status(200).json({ success: true, data: admins });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async atualizarAdmin(req: Request, res: Response) {
    try {
      if (!req.user.master)
        return res.status(403).json({ message: "Acesso restrito ao Master." });
      const { id } = req.params;
      const admin = await adminService.atualizarDadosAdmin(
        Number(id),
        req.body,
        req.user.id,
      );
      return res.status(200).json({ success: true, data: admin });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async excluirAdmin(req: Request, res: Response) {
    try {
      if (!req.user.master)
        return res.status(403).json({ message: "Acesso restrito ao Master." });
      const { id } = req.params;
      await adminService.deletarAdmin(Number(id), req.user.id);
      return res
        .status(200)
        .json({ success: true, message: "Administrador removido/bloqueado." });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async addExperiencia(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as any; // Validado pelo IdParamSchema
      const exp = await adminService.adicionarExperienciaCandidato(
        id_usuario,
        req.body,
        req.user.id,
      );
      return res.status(201).json(exp);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async addFormacao(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as any;
      const form = await adminService.adicionarFormacaoCandidato(
        id_usuario,
        req.body,
        req.user.id,
      );
      return res.status(201).json(form);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async addCompetencia(req: Request, res: Response) {
    try {
      const { id_usuario } = req.params as any;
      const result = await adminService.adicionarCompetenciaCandidato(
        id_usuario,
        req.body,
        req.user.id,
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  //gerenciar créditos empresa

  // Endpoint para o Admin adicionar créditos a uma empresa
  async atualizarCreditos(req: Request, res: Response) {
    try {
      const { id_empresa } = req.params;
      const { creditos_vagas, creditos_curriculos, modo } = req.body;
      const idAutor = req.user.id;

      if (!modo || !["SOMAR", "DEFINIR"].includes(modo)) {
        throw new Error("O modo deve ser 'SOMAR' ou 'DEFINIR'.");
      }

      const empresa = await adminService.gerenciarCreditosEmpresa(
        Number(id_empresa),
        { creditos_vagas, creditos_curriculos, modo },
        idAutor,
      );

      return res.status(200).json({
        success: true,
        message: "Créditos atualizados com sucesso.",
        data: {
          id_empresa: empresa.id_empresa,
          nome_fantasia: empresa.nome_fantasia,
          creditos_vagas: empresa.creditos_vagas,
          creditos_curriculos: empresa.creditos_curriculos,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
