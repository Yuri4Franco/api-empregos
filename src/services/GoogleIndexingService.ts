import { google } from "googleapis";

export class GoogleIndexingService {
  // Configura a autenticação usando as variáveis do .env
  private static getAuthClient() {
    // 1. O "!" garante ao TypeScript que a variável não será undefined
    const email = process.env.GOOGLE_CLIENT_EMAIL!;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

    return new google.auth.JWT({
      email: email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/indexing"],
    });
  }

  /**
   * Notifica o Google sobre o status da vaga
   * @param id_vaga ID da vaga no banco
   * @param acao URL_UPDATED (Publicar/Atualizar) ou URL_DELETED (Remover/Encerrar)
   */
  static async notificarGoogle(
    id_vaga: number,
    acao: "URL_UPDATED" | "URL_DELETED",
  ) {
    try {
      // Ajuste para a URL real do seu front-end
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "https://www.acivagas.com.br";
      const urlDaVaga = `${baseUrl}/vagas/${id_vaga}`;

      const jwtClient = this.getAuthClient();
      await jwtClient.authorize();

      const response = await google.indexing("v3").urlNotifications.publish({
        auth: jwtClient,
        requestBody: {
          url: urlDaVaga,
          type: acao,
        },
      });

      console.log(`[Google Indexing] Sucesso: ${acao} para vaga ${id_vaga}`);
      return response.data;
    } catch (error) {
      // Apenas logamos o erro para não travar a aplicação caso a API do Google oscile
      console.error(
        `[Google Indexing] Falha ao notificar vaga ${id_vaga}:`,
        error,
      );
    }
  }
}
