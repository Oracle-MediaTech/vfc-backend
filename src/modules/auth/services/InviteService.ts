import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import prisma from "../../../core/databases/prisma";
import { EmailService } from "../../email/services";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const BCRYPT_ROUNDS = 10;

const generateToken = () => randomBytes(32).toString("hex");

const buildInviteLink = (token: string): string => {
   // APP_URL is the externally-visible base, e.g. https://church.example.com.
   // The setup page lives under /admin so it ships with the Next admin build.
   const base = process.env.APP_URL || "http://localhost:3000";
   return `${base.replace(/\/$/, "")}/account-setup?token=${token}`;
};

export class InviteService {
   private email = new EmailService();

   /**
    * Create (or refresh) a password-setup invite for an existing user and email
    * them the link. Existing unused invites for the user are invalidated so
    * only the latest link works.
    */
   async createForUser(userId: string, createdById?: string | null) {
      const user = await prisma.user.findUnique({
         where: { id: userId },
         select: { id: true, firstName: true, email: true },
      });
      if (!user || !user.email) throw new Error("User not found");

      // Invalidate any prior unused tokens so the link in the latest email is
      // the only one that works.
      await prisma.inviteToken.updateMany({
         where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
         data: { expiresAt: new Date() },
      });

      const token = generateToken();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      console.log({ token });

      const created = await prisma.inviteToken.create({
         data: {
            userId,
            token,
            expiresAt,
            createdById: createdById ?? null,
         },
      });

      const settings = await prisma.churchSettings.findUnique({
         where: { id: "singleton" },
      });
      const churchName = settings?.name ?? "the Church";

      await this.email.sendInvite({
         to: user.email,
         firstName: user.firstName,
         inviteLink: buildInviteLink(token),
         churchName,
      });

      return {
         id: created.id,
         token: created.token,
         expiresAt: created.expiresAt,
         // Surface the link in the API response so admins running without SMTP
         // can copy it manually.
         inviteLink: buildInviteLink(token),
      };
   }

   /** Look up a token's metadata for the setup page to render the user's name. */
   async lookupToken(token: string) {
      const row = await prisma.inviteToken.findUnique({
         where: { token },
         include: {
            user: {
               select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
               },
            },
         },
      });
      if (!row) throw new Error("Invalid or expired invite link");
      if (row.usedAt) throw new Error("This invite link has already been used");
      if (row.expiresAt < new Date())
         throw new Error("This invite link has expired");
      return {
         email: row.user.email,
         firstName: row.user.firstName,
         lastName: row.user.lastName,
      };
   }

   /** Accept a token: set the user's password and mark the token used. */
   async accept(token: string, password: string) {
      const row = await prisma.inviteToken.findUnique({ where: { token } });
      if (!row) throw new Error("Invalid invite link");
      if (row.usedAt) throw new Error("This invite link has already been used");
      if (row.expiresAt < new Date())
         throw new Error("This invite link has expired");

      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

      await prisma.$transaction([
         prisma.user.update({
            where: { id: row.userId },
            data: { password: hashed },
         }),
         prisma.inviteToken.update({
            where: { id: row.id },
            data: { usedAt: new Date() },
         }),
      ]);

      return { success: true };
   }
}
