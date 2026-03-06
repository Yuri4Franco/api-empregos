import { Router } from "express";
import { AdminController } from "../controllers/AdminController.js";
import { AuthController } from "../controllers/AuthController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { VagaController } from "../controllers/VagaController.js";
import { AdminVagaController } from "../controllers/AdminVagaController.js";
import {
  AtualizarUsuarioSchema,
  ColaboradorSchema,
  EmpresaSchema,
  IdParamSchema,
  QueryListagemSchema,
  StatusEmpresaSchema,
  StatusUsuarioSchema,
} from "../schemas/auth.schema.js";
import { validate } from "../middlewares/validate.js";

const routes = Router();
const vagaController = new VagaController();
const adminController = new AdminController();
const authController = new AuthController();
const adminVagaController = new AdminVagaController();

routes.post("/auth/login", authController.login);

// Rotas de Admin
// Cadastrar nova empresa
routes.post(
  "/admin/cadastrar-empresa",
  authMiddleware(["ADM"]),
  validate(EmpresaSchema),
  adminController.cadastrarEmpresa,
);

// Listar todas
routes.get(
  "/admin/empresas",
  authMiddleware(["ADM"]),
  validate(QueryListagemSchema, "query"),
  adminController.listarEmpresas,
);

// Buscar uma específica
routes.get(
  "/admin/empresas/:id",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"), // <--- Valida o :id da URL
  adminController.obterDetalhesEmpresa,
);

// Desativar empresa (Soft Delete)
routes.patch(
  "/admin/empresas/:id/status",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(StatusEmpresaSchema, "body"),
  adminController.alterarStatusEmpresa,
);

// Adicionar usuário a empresa
routes.post(
  "/admin/empresas/:id/usuarios",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(ColaboradorSchema, "body"),
  adminController.cadastrarUsuarioEmEmpresa,
);

// Gerenciamento de Usuários (Colaboradores) pelo Admin
routes.put(
  "/admin/usuarios/:id_usuario",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"),
  validate(AtualizarUsuarioSchema, "body"),
  adminController.atualizarUsuario,
);

// Alternar status do usuário (Ativo <-> Bloqueado)
routes.patch(
  "/admin/usuarios/:id_usuario/status",
  authMiddleware(["ADM"]),
  validate(IdParamSchema, "params"), // Valida o :id_usuario na URL
  validate(StatusUsuarioSchema, "body"), // Valida o status no Body
  adminController.alternarStatusUsuario,
);

// Visualização de Usuários Empresa
routes.get(
  "/admin/usuarios-empresa",
  authMiddleware(["ADM"]),
  adminController.listarUsuariosEmpresa,
);

// Detalhes de um usuário específico
routes.get(
  "/admin/usuarios-empresa/:id_usuario",
  authMiddleware(["ADM"]),
  adminController.obterDetalhesUsuario,
);

// --- CANDIDATOS ---

// Listar todos os candidatos
routes.get(
  "/admin/candidatos",
  authMiddleware(["ADM"]),
  adminController.listarCandidatos,
);

// Cadastrar candidato manualmente
routes.post(
  "/admin/candidatos/manual",
  authMiddleware(["ADM"]),
  adminController.cadastrarCandidatoManual,
);

// Obter currículo completo de um candidato
routes.get(
  "/admin/candidatos/:id_usuario/curriculo",
  authMiddleware(["ADM"]),
  adminController.obterCurriculo,
);

// Atualizar perfil completo do candidato (dados pessoais + perfil profissional)
routes.put(
  "/admin/candidatos/:id/perfil-completo",
  authMiddleware(["ADM"]),
  adminController.atualizarPerfilCompleto,
);

// Adicionar experiência profissional ao candidato
routes.post(
  "/admin/candidatos/:id_usuario/experiencia",
  authMiddleware(["ADM"]),
  adminController.addExperiencia,
);

// Adicionar formação acadêmica ao candidato
routes.post(
  "/admin/candidatos/:id_usuario/formacao",
  authMiddleware(["ADM"]),
  adminController.addFormacao,
);

// --- UTILITÁRIOS ---
routes.patch(
  "/admin/usuarios/:id_usuario/reset-senha",
  authMiddleware(["ADM"]),
  adminController.resetarSenhaUsuario,
);
routes.patch(
  "/admin/empresas/:id_empresa/creditos",
  authMiddleware(["ADM"]),
  adminController.atualizarCreditos,
);

// --- GESTÃO DE EQUIPE (MASTER) ---

// Cadastrar novo admin
routes.post(
  "/admin/equipe",
  authMiddleware(["ADM"]),
  adminController.cadastrarNovoAdmin,
);

// Listar todos os admins
routes.get(
  "/admin/equipe",
  authMiddleware(["ADM"]),
  adminController.listarAdmins,
);

routes.put(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  adminController.atualizarAdmin,
);

routes.delete(
  "/admin/equipe/:id",
  authMiddleware(["ADM"]),
  adminController.excluirAdmin,
);

routes.get(
  "/admin/vagas/pendentes",
  authMiddleware(["ADM"]),
  adminVagaController.listarPendentes,
);

routes.patch(
  "/admin/vagas/:id/moderacao",
  authMiddleware(["ADM"]),
  adminVagaController.moderar,
);

routes.get("/vagas/:id", vagaController.buscarDetalhes);

export default routes;
