import prisma from "../../../core/databases/prisma";

const SINGLETON_ID = "singleton";

export interface UpdateChurchSettingsInput {
   name?: string;
   email?: string;
   phoneNumber?: string;
   logoUrl?: string | null;
   address?: string | null;
}

export class SettingsService {
   async getChurchSettings() {
      let settings = await prisma.churchSettings.findUnique({
         where: { id: SINGLETON_ID },
      });
      if (!settings) {
         // First-run safety: the migration seeds this row, but in case it's missing
         // (e.g. local dev DB), create it lazily so reads never 404.
         settings = await prisma.churchSettings.create({
            data: { id: SINGLETON_ID, name: "My Church" },
         });
      }
      return settings;
   }

   async updateChurchSettings(data: UpdateChurchSettingsInput) {
      return prisma.churchSettings.upsert({
         where: { id: SINGLETON_ID },
         update: data,
         create: {
            id: SINGLETON_ID,
            name: data.name ?? "My Church",
            email: data.email ?? "",
            phoneNumber: data.phoneNumber ?? "",
            logoUrl: data.logoUrl ?? null,
            address: data.address ?? null,
         },
      });
   }
}
