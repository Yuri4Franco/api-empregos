import { agendarEncerramentoVagasAutomatico } from "./jobs/EncerramentoVagaJob.js";
import { agendarInativacaoPorInatividade } from "./jobs/InativacaoPerfilJob.js";
import { agendarLembretePerfilIncompleto } from "./jobs/LembretePerfilJob.js";
import { agendarLimpezaContasPendentes } from "./jobs/LimpezaContasJob.js";

import "./workers/emailWorker.js";

console.log("Iniciando o Worker de Tarefas Agendadas da ACI Vagas...");

agendarLimpezaContasPendentes();
agendarInativacaoPorInatividade();
agendarEncerramentoVagasAutomatico();
agendarLembretePerfilIncompleto();

console.log("Todos os Cronjobs foram registrados e estão aguardando o relógio.");