import { agendarInativacaoPorInatividade } from "./jobs/InativacaoPerfilJob";
import { agendarLembretePerfilIncompleto } from "./jobs/LembretePerfilJob";
import { agendarLimpezaContasPendentes } from "./jobs/LimpezaContasJob";


console.log("Iniciando o Worker de Tarefas Agendadas da ACI Vagas...");

//jobs para os usuarios candidatos
agendarLimpezaContasPendentes();
agendarLembretePerfilIncompleto();
agendarInativacaoPorInatividade();

console.log("Todos os Cronjobs foram registrados e estão aguardando o relógio.");