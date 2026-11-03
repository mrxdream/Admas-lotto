/**
 * Admas lottery worker
 *
 * Re-runs matching + notifications for all PUBLISHED draws.
 * Useful when tickets are submitted after a draw was already published.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3000 ADMIN_API_SECRET=... npx tsx src/index.ts
 *
 * Or schedule via cron:
 *   */15 * * * * cd /path/to/apps/worker && npm start
 */

import "dotenv/config";

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3000";
const adminSecret = process.env.ADMIN_API_SECRET;

if (!adminSecret) {
  console.error("ADMIN_API_SECRET is required");
  process.exit(1);
}

async function listPublishedDraws() {
  const response = await fetch(`${apiBaseUrl}/api/admin/draws`, {
    headers: { "x-admin-api-secret": adminSecret! },
  });

  if (!response.ok) {
    throw new Error(`Failed to list draws: ${response.status}`);
  }

  const data = (await response.json()) as {
    draws: { id: string; drawCode: string; status: string }[];
  };

  return data.draws.filter((d) => d.status === "PUBLISHED");
}

async function matchDraw(drawId: string, drawCode: string) {
  const response = await fetch(
    `${apiBaseUrl}/api/admin/draws/${drawId}/match`,
    {
      method: "POST",
      headers: { "x-admin-api-secret": adminSecret! },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Match failed for ${drawCode}: ${response.status} ${body}`);
  }

  return response.json() as Promise<{
    matching: {
      ticketsChecked: number;
      winnersFound: number;
      notificationsSent: number;
    };
  }>;
}

async function main() {
  console.log(`[worker] Starting at ${new Date().toISOString()}`);
  console.log(`[worker] API: ${apiBaseUrl}`);

  const draws = await listPublishedDraws();
  console.log(`[worker] Found ${draws.length} published draw(s)`);

  for (const draw of draws) {
    try {
      const result = await matchDraw(draw.id, draw.drawCode);
      const m = result.matching;
      console.log(
        `[worker] ${draw.drawCode}: checked=${m.ticketsChecked} winners=${m.winnersFound} notified=${m.notificationsSent}`,
      );
    } catch (error) {
      console.error(`[worker] Error on ${draw.drawCode}:`, error);
    }
  }

  console.log(`[worker] Done`);
}

main().catch((error) => {
  console.error("[worker] Fatal:", error);
  process.exit(1);
});
