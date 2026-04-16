import { transporter } from "../config/mailer";


export class EmailService {
  async enviarEmailAtivacao(email: string, nome: string, token: string) {
    const urlAtivacao = `${process.env.APP_URL}/ativar/${token}`;

    const mailOptions = {
      from: `"ACI Empregos" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Ative sua conta - ACI Empregos Panambi",
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Olá, ${nome}!</h2>
          <p>Seja bem-vindo à plataforma <strong>ACI Empregos</strong>.</p>
          <p>Para concluir seu cadastro e começar a se candidatar às vagas, clique no botão abaixo:</p>
          <a href="${urlAtivacao}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Ativar Minha Conta
          </a>
          <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
          <p>${urlAtivacao}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Este link é válido para ativação imediata. </p>
        </div>
      `,
    };

    return await transporter.sendMail(mailOptions);
  }
}
