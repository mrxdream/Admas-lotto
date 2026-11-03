import { prisma } from "./prisma";

type MatchResult = {
  drawId: string;
  drawCode: string;
  drawDateText: string;
  ticketsChecked: number;
  winnersFound: number;
  notificationsSent: number;
  winners: {
    ticketId: string;
    ticketNumber: string;
    prizeName: string;
    prizeAmount: string | null;
    currency: string;
    telegramId: string;
    firstName: string | null;
  }[];
};

/** Ethiopian month names → month number (1–13, including ጳጉሜ). */
const ETH_MONTHS: Record<string, number> = {
  መስከረም: 1,
  ጥቅምት: 2,
  ኅዳር: 3,
  ህዳር: 3,
  ታኅሣሥ: 4,
  ታህሳስ: 4,
  ጥር: 5,
  የካቲት: 6,
  መጋቢት: 7,
  ሚያዝያ: 8,
  ግንቦት: 9,
  ሰኔ: 10,
  ሐምሌ: 11,
  ነሐሴ: 12,
  ጳጉሜ: 13,
};

/**
 * Build a loose comparable key from a draw-date string.
 * Supports:
 *  - "ጥቅምት 24/2019 ዓ.ም"
 *  - "24/2/2019" (day/month/year)
 *  - "2/24/2019" etc.
 * Returns e.g. "2-24-2019" or null if unparseable.
 */
export function normalizeDrawDateKey(text: string): string | null {
  const cleaned = text.trim().replace(/\s+/g, " ");

  // Ethiopian: MONTH day/year
  for (const [name, month] of Object.entries(ETH_MONTHS)) {
    if (cleaned.includes(name)) {
      const m = cleaned.match(
        new RegExp(`${name}\\s*(\\d{1,2})\\s*/\\s*(\\d{4})`),
      );
      if (m) {
        const day = Number(m[1]);
        const year = Number(m[2]);
        return `${month}-${day}-${year}`;
      }
    }
  }

  // Numeric: d/m/y or m/d/y — prefer day/month/year when first number > 12
  const numeric = cleaned.match(
    /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/,
  );
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = Number(numeric[3]);
    // If first part > 12, treat as day/month/year
    if (a > 12) {
      return `${b}-${a}-${year}`;
    }
    // If second > 12, treat as month/day/year
    if (b > 12) {
      return `${a}-${b}-${year}`;
    }
    // Ambiguous: assume day/month/year (common in Ethiopia for mixed notes)
    return `${b}-${a}-${year}`;
  }

  // Digits only fallback: collect day + year if present
  const dayYear = cleaned.match(/(\d{1,2})\s*\/\s*(\d{4})/);
  if (dayYear) {
    return `?-${Number(dayYear[1])}-${Number(dayYear[2])}`;
  }

  return null;
}

function datesCompatible(
  drawDateText: string,
  ticketDateText: string,
): boolean {
  if (drawDateText.trim() === ticketDateText.trim()) {
    return true;
  }

  const a = normalizeDrawDateKey(drawDateText);
  const b = normalizeDrawDateKey(ticketDateText);
  if (!a || !b) return false;

  // Exact normalized match
  if (a === b) return true;

  // If one side has unknown month (?-day-year), compare day+year only
  const [am, ad, ay] = a.split("-");
  const [bm, bd, by] = b.split("-");
  if (ay === by && ad === bd) {
    if (am === "?" || bm === "?" || am === bm) return true;
  }

  return false;
}

/**
 * Match tickets for a draw:
 * 1. Unchecked tickets whose draw date matches (exact or normalized)
 * 2. Unchecked tickets whose ticket number is a winning number on this draw
 *    (covers cases where the admin typed a different date format)
 */
export async function matchTicketsForDraw(
  drawId: string,
): Promise<MatchResult> {
  const draw = await prisma.lotteryDraw.findUnique({
    where: { id: drawId },
    include: {
      prizes: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!draw) {
    throw new Error("Draw not found");
  }

  if (draw.prizes.length === 0) {
    throw new Error("Draw has no prize entries to match against");
  }

  const prizeByNumber = new Map(
    draw.prizes.map((p) => [p.winningNumber.trim(), p]),
  );
  const winningNumbers = [...prizeByNumber.keys()];

  // Load candidates: same normalized date OR ticket number is a winner on this draw
  const candidates = await prisma.lotteryTicket.findMany({
    where: {
      isChecked: false,
      OR: [
        { drawDateText: draw.drawDateText },
        { ticketNumber: { in: winningNumbers } },
      ],
    },
    include: {
      user: {
        select: {
          telegramId: true,
          firstName: true,
          isActive: true,
        },
      },
    },
  });

  // Also pull unchecked tickets and filter by normalized date in JS
  // (Prisma can't express Ethiopian date normalization)
  const moreUnchecked = await prisma.lotteryTicket.findMany({
    where: {
      isChecked: false,
      id: { notIn: candidates.map((c) => c.id) },
    },
    include: {
      user: {
        select: {
          telegramId: true,
          firstName: true,
          isActive: true,
        },
      },
    },
    take: 500,
  });

  const byDate = moreUnchecked.filter((t) =>
    datesCompatible(draw.drawDateText, t.drawDateText),
  );

  const ticketsMap = new Map<string, (typeof candidates)[0]>();
  for (const t of [...candidates, ...byDate]) {
    ticketsMap.set(t.id, t);
  }
  const tickets = [...ticketsMap.values()];

  const winners: MatchResult["winners"] = [];
  let winnersFound = 0;

  for (const ticket of tickets) {
    const prize = prizeByNumber.get(ticket.ticketNumber.trim());
    const isWinner = Boolean(prize);

    // Only mark as checked if date is compatible OR they are a number match winner
    // Non-winners with only loose number-list inclusion and incompatible dates
    // should not be marked "no win" for the wrong draw.
    const dateOk = datesCompatible(draw.drawDateText, ticket.drawDateText);

    if (!isWinner && !dateOk) {
      continue;
    }

    await prisma.lotteryTicket.update({
      where: { id: ticket.id },
      data: {
        isChecked: true,
        isWinner,
        matchedPrizeId: prize?.id ?? null,
        checkedAt: new Date(),
      },
    });

    if (isWinner && prize && ticket.user.isActive) {
      winnersFound += 1;
      winners.push({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        prizeName: prize.prizeName,
        prizeAmount: prize.prizeAmount?.toString() ?? null,
        currency: prize.currency,
        telegramId: ticket.user.telegramId.toString(),
        firstName: ticket.user.firstName,
      });
    }
  }

  return {
    drawId: draw.id,
    drawCode: draw.drawCode,
    drawDateText: draw.drawDateText,
    ticketsChecked: tickets.filter(
      (t) =>
        datesCompatible(draw.drawDateText, t.drawDateText) ||
        prizeByNumber.has(t.ticketNumber.trim()),
    ).length,
    winnersFound,
    notificationsSent: 0,
    winners,
  };
}

/**
 * Send Telegram notifications to winners who have not been notified yet.
 */
export async function notifyWinnersForDraw(drawId: string): Promise<number> {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.warn("BOT_TOKEN not set — skipping winner notifications");
    return 0;
  }

  const draw = await prisma.lotteryDraw.findUnique({
    where: { id: drawId },
    select: { id: true, drawCode: true, drawDateText: true },
  });

  if (!draw) {
    throw new Error("Draw not found");
  }

  const pending = await prisma.lotteryTicket.findMany({
    where: {
      isWinner: true,
      notifiedAt: null,
      matchedPrize: {
        drawId: draw.id,
      },
    },
    include: {
      user: {
        select: {
          telegramId: true,
          firstName: true,
          language: true,
          isActive: true,
        },
      },
      matchedPrize: true,
    },
  });

  let sent = 0;

  for (const ticket of pending) {
    if (!ticket.user.isActive || !ticket.matchedPrize) continue;

    const name = ticket.user.firstName || "ተጠቃሚ";
    const prize = ticket.matchedPrize;
    const amountText =
      prize.prizeAmount != null
        ? `${prize.prizeAmount.toString()} ${prize.currency}`
        : prize.prizeName;

    const message =
      ticket.user.language === "en"
        ? `🎉 Congratulations ${name}!\n\n` +
          `Your Admas lottery ticket ${ticket.ticketNumber} won!\n` +
          `Prize: ${prize.prizeName}\n` +
          `Amount: ${amountText}\n` +
          `Draw: ${draw.drawCode} (${draw.drawDateText})\n\n` +
          `Please keep your original SMS and contact Admas support to claim your prize.`
        : `🎉 እንኳን ደስ አለዎት ${name}!\n\n` +
          `የአድማስ ሎተሪ ትኬትዎ ${ticket.ticketNumber} አሸንፏል!\n` +
          `ሽልማት: ${prize.prizeName}\n` +
          `መጠን: ${amountText}\n` +
          `ዕጣ: ${draw.drawCode} (${draw.drawDateText})\n\n` +
          `እባክዎ የመጀመሪያውን SMS ይያዙና ሽልማትዎን ለመቀበል የአድማስ ድጋፍን ያነጋግሩ።`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ticket.user.telegramId.toString(),
            text: message,
          }),
        },
      );

      if (response.ok) {
        await prisma.lotteryTicket.update({
          where: { id: ticket.id },
          data: { notifiedAt: new Date() },
        });
        sent += 1;
      } else {
        const body = await response.text();
        console.error(
          `Failed to notify ticket ${ticket.id}:`,
          response.status,
          body,
        );
      }
    } catch (error) {
      console.error(`Notification error for ticket ${ticket.id}:`, error);
    }
  }

  return sent;
}

/**
 * Full publish pipeline: match tickets then notify winners.
 */
export async function publishDrawResults(drawId: string): Promise<MatchResult> {
  const match = await matchTicketsForDraw(drawId);
  const notificationsSent = await notifyWinnersForDraw(drawId);
  return { ...match, notificationsSent };
}
