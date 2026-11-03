import { prisma } from "./prisma";

export type Plan = "FREE" | "PLUS" | "PREMIUM";

export type AppSettings = {
  limitsEnabled: boolean;
  freeTicketLimit: number;
  plusTicketLimit: number;
  premiumTicketLimit: number;
  plusPriceEtb: string;
  premiumPriceEtb: string;
  telebirrNumber: string;
  telebirrName: string;
  upgradeInfoAm: string | null;
  upgradeInfoEn: string | null;
};

const DEFAULTS: AppSettings = {
  limitsEnabled: false,
  freeTicketLimit: 5,
  plusTicketLimit: 15,
  premiumTicketLimit: 30,
  plusPriceEtb: "5",
  premiumPriceEtb: "15",
  telebirrNumber: "",
  telebirrName: "",
  upgradeInfoAm: null,
  upgradeInfoEn: null,
};

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return {
    limitsEnabled: row.limitsEnabled,
    freeTicketLimit: row.freeTicketLimit,
    plusTicketLimit: row.plusTicketLimit,
    premiumTicketLimit: row.premiumTicketLimit,
    plusPriceEtb: row.plusPriceEtb.toString(),
    premiumPriceEtb: row.premiumPriceEtb.toString(),
    telebirrNumber: row.telebirrNumber,
    telebirrName: row.telebirrName,
    upgradeInfoAm: row.upgradeInfoAm,
    upgradeInfoEn: row.upgradeInfoEn,
  };
}

export function limitForPlan(settings: AppSettings, plan: Plan): number {
  switch (plan) {
    case "PLUS":
      return settings.plusTicketLimit;
    case "PREMIUM":
      return settings.premiumTicketLimit;
    default:
      return settings.freeTicketLimit;
  }
}

/** Effective plan — expired paid plans fall back to FREE. */
export function effectivePlan(
  plan: Plan,
  planExpiresAt: Date | null | undefined,
): Plan {
  if (plan === "FREE") return "FREE";
  if (!planExpiresAt) return plan;
  if (planExpiresAt.getTime() < Date.now()) return "FREE";
  return plan;
}

export { DEFAULTS as SETTINGS_DEFAULTS };
