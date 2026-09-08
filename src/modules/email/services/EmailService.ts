import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../../../core/utils";

interface SmtpEnv {
   host?: string;
   port?: number;
   user?: string;
   password?: string;
   sender?: string;
}

const readSmtpEnv = (): SmtpEnv => ({
   host: process.env.SMTP_HOSTNAME || process.env.SMTP_HOST,
   port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
   user: process.env.SMTP_USERNAME || process.env.SMTP_USER,
   password: process.env.SMTP_PASSWORD,
   sender: process.env.SMTP_SENDER,
});

const isConfigured = (env: SmtpEnv) =>
   Boolean(env.host && env.port && env.user && env.password && env.sender);

const buildTransport = (env: SmtpEnv): Transporter =>
   nodemailer.createTransport({
      host: env.host!,
      port: env.port!,
      secure: process.env.SMTP_SECURE === "true" || env.port === 465,
      auth: { user: env.user!, pass: env.password! },
   });

/**
 * Sender for transactional email. When SMTP env vars are missing the service
 * falls back to a console-stub so dev / packaged installs without SMTP
 * configured can still drive the invite flow — the link prints to the PM2
 * logs and the admin can hand-deliver it.
 */
export class EmailService {
   private transporter: Transporter | null = null;
   private sender: string | null = null;

   constructor() {
      const env = readSmtpEnv();
      if (isConfigured(env)) {
         this.transporter = buildTransport(env);
         this.sender = env.sender!;

         this.transporter.verify((error) => {
            if (error) {
               console.error("[email] SMTP connection failed:", error);
            } else {
               logger.info(
                  `[email] SMTP configured (host=${env.host} port=${env.port})`,
               );
            }
         });
      } else {
         logger.warn(
            "[email] SMTP not configured — invite emails will only be logged",
         );
      }
   }

   private async send(
      to: string,
      subject: string,
      html: string,
      text: string,
   ): Promise<void> {
      if (!this.transporter || !this.sender) {
         logger.info(
            `[email-stub] To: ${to}\n  Subject: ${subject}\n  ${text}`,
         );
         return;
      }
      await this.transporter.sendMail({
         from: this.sender,
         to,
         subject,
         html,
         text,
      });
      console.log("Email sent successfully...");
   }

   /** Branded invite email for a new exco / worker. */
   async sendInvite(opts: {
      to: string;
      firstName: string;
      inviteLink: string;
      churchName: string;
   }): Promise<void> {
      const { to, firstName, inviteLink, churchName } = opts;
      const subject = `Set your password for ${churchName}`;
      const text =
         `Hi ${firstName},\n\n` +
         `You've been invited to ${churchName}. Click the link below to set ` +
         `your password and access your dashboard:\n\n${inviteLink}\n\n` +
         `This link expires in 48 hours. If you didn't expect this email, ` +
         `you can safely ignore it.`;
      const html = `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>You've been invited to <strong>${escapeHtml(churchName)}</strong>.
         Click the button below to set your password and access your dashboard:</p>
      <p>
        <a href="${inviteLink}"
           style="display:inline-block;padding:10px 18px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Set Password
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;">
        Or copy this link into your browser:<br/>
        <span style="word-break:break-all;">${escapeHtml(inviteLink)}</span>
      </p>
      <p style="font-size:12px;color:#6b7280;">
        This link expires in 48 hours. If you didn't expect this email, you can safely ignore it.
      </p>`;
      await this.send(to, subject, html, text);
   }
}

const escapeHtml = (s: string) =>
   s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
