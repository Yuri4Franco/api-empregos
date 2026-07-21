export async function validarRecaptcha(
  token: string,
  actionEsperada: string = "register",
): Promise<boolean> {
  if (!token) return false;

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error("❌ RECAPTCHA_SECRET_KEY não configurada no backend.");
    return false;
  }

  try {
    // O Google exige que os parâmetros sejam enviados no formato URLSearchParams (form-data)
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    const resposta = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    const dados = await resposta.json();

    /* O retorno do Google (dados) tem este formato:
      {
        "success": true|false,
        "score": number (de 0.0 a 1.0),
        "action": string
      }
    */

    // 1. Verifica se a requisição ao Google deu certo
    if (!dados.success) {
      console.warn(
        "⚠️ Falha na verificação do reCAPTCHA:",
        dados["error-codes"],
      );
      return false;
    }

    // 2. Verifica se a ação que o script disparou é a mesma que esperávamos (evita reaproveitamento de token)
    if (dados.action !== actionEsperada) {
      console.warn(
        `⚠️ Ação do reCAPTCHA divergente. Esperado: ${actionEsperada}, Recebido: ${dados.action}`,
      );
      return false;
    }

    // 3. REGRA DE CORTE: Score maior ou igual a 0.5 (padrão de segurança)
    if (dados.score < 0.5) {
      console.warn(
        `🤖 Bloqueio de Bot por Score Baixo no reCAPTCHA. Score: ${dados.score}`,
      );
      return false;
    }
    
    return true;
  } catch (erro) {
    console.error(
      "❌ Erro ao comunicar com os servidores do Google reCAPTCHA:",
      erro,
    );
    return false;
  }
}
