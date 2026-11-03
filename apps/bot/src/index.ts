import "dotenv/config";
import { createServer } from "node:http";
import { Bot, InlineKeyboard, Keyboard } from "grammy";

const token = process.env.BOT_TOKEN;
const apiBaseUrl = process.env.API_BASE_URL;
const apiSecret = process.env.BOT_API_SECRET;

if (!token || !apiBaseUrl || !apiSecret) {
  throw new Error(
    "Missing BOT_TOKEN, API_BASE_URL, or BOT_API_SECRET in apps/bot/.env",
  );
}

const bot = new Bot(token);

/* ---------- i18n ---------- */

type Lang = "am" | "en";

const t = {
  am: {
    welcome: (name: string) =>
      `ሰላም ${name}! 🎉\n\n` +
      `ወደ *Admas Lottery Checker* እንኳን በደህና መጡ።\n\n` +
      `🎟️ የአድማስ ሎተሪ SMS መልዕክትዎን ወደዚህ ይላኩ — ትኬቱን እናስቀምጣለን።\n` +
      `📢 ውጤት ሲወጣ አሸናፊ ከሆኑ ወዲያውኑ እናሳውቅዎታለን።\n\n` +
      `ከታች ያለውን ሜኑ ይጠቀሙ ወይም ትኬት SMS ያስተላልፉ።`,
    help:
      `*እንዴት መጠቀም እንደሚቻል*\n\n` +
      `1️⃣ የአድማስ ሎተሪ SMS *ያስተላልፉ* ወይም ጽሑፉን *ኮፒ አድርገው ይለጥፉ*\n` +
      `   (ብዙ ትኬቶችን በአንድ ጊዜ መለጠፍ ይቻላል)\n` +
      `2️⃣ ያረጋግጡና እናስቀምጣለን\n` +
      `3️⃣ ውጤት ሲወጣ አሸናፊ ከሆኑ እናሳውቅዎታለን\n\n` +
      `*ትዕዛዞች*\n` +
      `/start — መጀመሪያ / ሜኑ\n` +
      `/mytickets — የተቀመጡ ትኬቶች\n` +
      `/winners — አሸናፊ ትኬቶችዎ\n` +
      `/upgrade — ዕቅድ ያሻሽሉ\n` +
      `/help — እገዛ\n` +
      `/lang — ቋንቋ ቀይር (አማ / EN)`,
    menuTickets: "🎟️ ትኬቶቼ",
    menuWinners: "🏆 አሸናፊዎች",
    menuUpgrade: "⭐ አሻሽል",
    menuHelp: "❓ እገዛ",
    menuLang: "🌐 Language",
    limitReached: (used: number, limit: number, plan: string) =>
      `⛔ የትኬት ገደብ ላይ ደርሰዋል።\n\n` +
      `ዕቅድ: ${plan}\n` +
      `ያስቀመጡት: ${used} / ${limit}\n\n` +
      `ተጨማሪ ትኬት ለማስቀመጥ ዕቅድዎን ያሻሽሉ — /upgrade`,
    upgradeTitle: "⭐ ዕቅድ ያሻሽሉ",
    choosePlan: "የሚፈልጉትን ዕቅድ ይምረጡ፣ በቴሌብር ይክፈሉ፣ ከዚያ የክፍያ ስክሪንሹት ይላኩ።",
    btnPlus: (price: string, limit: number) =>
      `Plus — ${price} ብር / ${limit} ትኬት`,
    btnPremium: (price: string, limit: number) =>
      `Premium — ${price} ብር / ${limit} ትኬት`,
    payInstructions: (
      plan: string,
      price: string,
      number: string,
      name: string,
    ) =>
      `ዕቅድ: *${plan}*\n` +
      `ክፍያ: *${price} ብር*\n\n` +
      (number
        ? `ቴሌብር: \`${number}\`${name ? ` (${name})` : ""}\n\n`
        : "ቴሌብር ቁጥር በአስተዳዳሪ ገና አልተዘጋጀም።\n\n") +
      `ከከፈሉ በኋላ *የክፍያ ስክሪንሹት* ወደዚህ ቦት ይላኩ። አስተዳዳሪ ካረጋገጠ በኋላ ዕቅድዎ ይነቃል።`,
    sendScreenshot: "እባክዎ የክፍያ ስክሪንሹት ፎቶ ይላኩ።",
    paymentSubmitted: "✅ የክፍያ ማስረጃ ተልኳል። አስተዳዳሪ ካረጋገጠ በኋላ እናሳውቅዎታለን።",
    paymentFail: "ክፍያ ማስረጃ ማስገባት አልተቻለም። ቆይተው ይሞክሩ።",
    planInfo: (
      plan: string,
      used: number,
      limit: number | null,
      limitsOn: boolean,
    ) =>
      `ዕቅድዎ: *${plan}*\n` +
      (limitsOn && limit != null
        ? `ትኬቶች: ${used} / ${limit}`
        : `ትኬቶች: ${used} (ገደብ አልተጣለም)`),
    alreadyPremium:
      "እርስዎ አስቀድመው *Premium* ላይ ነዎት — ከፍተኛው ዕቅድ።\n\nትኬት ገደብዎን ሙሉ በሙሉ መጠቀም ይችላሉ።",
    upgradeOnlyPremium: "ወደ Premium ማሻሻል ይችላሉ፡",
    noDowngrade: "ይህ ዕቅድ ከአሁኑ ዕቅድዎ ያነሰ ወይም ተመሳሳይ ነው።",
    noTickets:
      "🎟️ እስካሁን ያስቀመጡት ትኬት የለም።\n\n" + "የአድማስ ሎተሪ SMS መልዕክትዎን ወደዚህ *ያስተላልፉ*።",
    ticketsHeader: (n: number) => `🎟️ የእርስዎ ትኬቶች (${n})`,
    ticketLine: (i: number, num: string) => `${i}. ትኬት: \`${num}\``,
    expDate: (d: string) => `   የማብቂያ: ${d}`,
    drawDate: (d: string) => `   የዕጣ ቀን: ${d}`,
    winnerLine: (name: string, amount: string) =>
      `   🎉 *አሸናፊ!* ${name}${amount}`,
    notWon: "   ውጤት: አላሸነፈም",
    pending: "   ውጤት: በመጠባበቅ ላይ",
    noWinners: "🏆 እስካሁን አሸናፊ ትኬት የለዎትም። መልካም ዕድል!",
    winnersHeader: (n: number) => `🏆 አሸናፊ ትኬቶችዎ (${n})`,
    parseFail:
      "የሎተሪ መልዕክቱን በትክክል ማንበብ አልቻልኩም።\n\n" +
      "እባክዎ የ*አድማስ ሎተሪ* SMS መልዕክቱን *ያስተላልፉ*።\n" +
      "የትኬት ቁጥሩ (ለምሳሌ `123-4567890`) እና ሁለቱ ቀኖች በግልጽ መታየት አለባቸው።",
    confirmTitle: "🎟️ የትኬት መረጃ ተገኝቷል",
    confirmBody: (num: string, exp: string, draw: string) =>
      `የትኬት ቁጥር: \`${num}\`\n` +
      `የማብቂያ ቀን: ${exp}\n` +
      `የዕጣ የወጪ ቀን: ${draw}\n\n` +
      `መረጃው ትክክል ነው?`,
    btnConfirm: "✅ አረጋግጥና አስቀምጥ",
    btnCancel: "❌ ሰርዝ",
    saved: (num: string, draw: string) =>
      `✅ ትኬትዎ ተቀምጧል!\n\n` +
      `ትኬት: \`${num}\`\n` +
      `የዕጣ ቀን: ${draw}\n\n` +
      `ውጤት ሲወጣ እናሳውቅዎታለን።`,
    alreadySaved: "ℹ️ ይህ ትኬት ከዚህ በፊት ተቀምጧል።",
    cancelled: "የትኬት ማስቀመጥ ተሰርዟል።",
    confirmExpired: "የማረጋገጫ ጊዜው አልፏል። SMS መልዕክቱን እንደገና ይላኩ።",
    saveFail: "ትኬቱን ማስቀመጥ አልተቻለም። እባክዎ ቆይተው እንደገና ይሞክሩ።",
    loadFail: "ትኬቶችዎን ማምጣት አልተቻለም። እባክዎ /start ብለው እንደገና ይሞክሩ።",
    serviceDown: "አገልግሎቱ ለጊዜው አይገኝም። እባክዎ ቆይተው ይሞክሩ።",
    regFail: "ይቅርታ! ምዝገባዎን ማጠናቀቅ አልተቻለም። እባክዎ ቆይተው እንደገና ይሞክሩ።",
    langSwitched: "ቋንቋ ወደ አማርኛ ተቀይሯል።",
    unknown:
      "አልገባኝም 🤔\n\n" +
      "የአድማስ ሎተሪ SMS ያስተላልፉ፣ ወይም ከታች ያለውን ሜኑ ይጠቀሙ።\n" +
      "/help ለተጨማሪ መረጃ።",
  },
  en: {
    welcome: (name: string) =>
      `Hi ${name}! 🎉\n\n` +
      `Welcome to *Admas Lottery Checker*.\n\n` +
      `🎟️ Forward your Admas lottery SMS here — we'll save the ticket.\n` +
      `📢 When results are out, we'll notify you if you win.\n\n` +
      `Use the menu below or forward a ticket SMS.`,
    help:
      `*How to use*\n\n` +
      `1️⃣ *Forward* an Admas SMS or *paste* the text here\n` +
      `   (you can paste many tickets at once)\n` +
      `2️⃣ Confirm and we save them\n` +
      `3️⃣ When results are published, winners get notified\n\n` +
      `*Commands*\n` +
      `/start — Home / menu\n` +
      `/mytickets — Your saved tickets\n` +
      `/winners — Your winning tickets\n` +
      `/upgrade — Upgrade plan\n` +
      `/help — Help\n` +
      `/lang — Switch language (AM / EN)`,
    menuTickets: "🎟️ My tickets",
    menuWinners: "🏆 Winners",
    menuUpgrade: "⭐ Upgrade",
    menuHelp: "❓ Help",
    menuLang: "🌐 አማርኛ",
    limitReached: (used: number, limit: number, plan: string) =>
      `⛔ Ticket limit reached.\n\n` +
      `Plan: ${plan}\n` +
      `Saved: ${used} / ${limit}\n\n` +
      `Upgrade for more tickets — /upgrade`,
    upgradeTitle: "⭐ Upgrade your plan",
    choosePlan:
      "Pick a plan, pay via Telebirr, then send the payment screenshot here.",
    btnPlus: (price: string, limit: number) =>
      `Plus — ${price} ETB / ${limit} tickets`,
    btnPremium: (price: string, limit: number) =>
      `Premium — ${price} ETB / ${limit} tickets`,
    payInstructions: (
      plan: string,
      price: string,
      number: string,
      name: string,
    ) =>
      `Plan: *${plan}*\n` +
      `Price: *${price} ETB*\n\n` +
      (number
        ? `Telebirr: \`${number}\`${name ? ` (${name})` : ""}\n\n`
        : "Telebirr number not configured yet.\n\n") +
      `After paying, send the *payment screenshot* to this bot. An admin will verify and activate your plan.`,
    sendScreenshot: "Please send a photo of your payment screenshot.",
    paymentSubmitted:
      "✅ Payment proof submitted. We'll notify you once an admin verifies it.",
    paymentFail: "Could not submit payment proof. Try again later.",
    planInfo: (
      plan: string,
      used: number,
      limit: number | null,
      limitsOn: boolean,
    ) =>
      `Your plan: *${plan}*\n` +
      (limitsOn && limit != null
        ? `Tickets: ${used} / ${limit}`
        : `Tickets: ${used} (no limit active)`),
    alreadyPremium:
      "You're already on *Premium* — the highest plan.\n\nYou can use your full ticket limit.",
    upgradeOnlyPremium: "You can upgrade to Premium:",
    noDowngrade: "That plan is the same or lower than your current plan.",
    noTickets:
      "🎟️ You have no saved tickets yet.\n\n" +
      "*Forward* your Admas lottery SMS here to save one.",
    ticketsHeader: (n: number) => `🎟️ Your tickets (${n})`,
    ticketLine: (i: number, num: string) => `${i}. Ticket: \`${num}\``,
    expDate: (d: string) => `   Expires: ${d}`,
    drawDate: (d: string) => `   Draw date: ${d}`,
    winnerLine: (name: string, amount: string) =>
      `   🎉 *Winner!* ${name}${amount}`,
    notWon: "   Result: did not win",
    pending: "   Result: pending",
    noWinners: "🏆 No winning tickets yet. Good luck!",
    winnersHeader: (n: number) => `🏆 Your winning tickets (${n})`,
    parseFail:
      "I couldn't read that lottery message.\n\n" +
      "Please *forward* the official *Admas lottery* SMS.\n" +
      "It must clearly show the ticket number (e.g. `123-4567890`) and both dates.",
    confirmTitle: "🎟️ Ticket details found",
    confirmBody: (num: string, exp: string, draw: string) =>
      `Ticket: \`${num}\`\n` +
      `Expires: ${exp}\n` +
      `Draw date: ${draw}\n\n` +
      `Does this look correct?`,
    btnConfirm: "✅ Confirm & save",
    btnCancel: "❌ Cancel",
    saved: (num: string, draw: string) =>
      `✅ Ticket saved!\n\n` +
      `Ticket: \`${num}\`\n` +
      `Draw date: ${draw}\n\n` +
      `We'll notify you when results are out.`,
    alreadySaved: "ℹ️ This ticket was already saved.",
    cancelled: "Ticket save cancelled.",
    confirmExpired: "Confirmation expired. Please send the SMS again.",
    saveFail: "Could not save the ticket. Please try again later.",
    loadFail: "Could not load your tickets. Try /start again.",
    serviceDown: "Service is temporarily unavailable. Please try again later.",
    regFail: "Sorry! Could not finish registration. Please try again later.",
    langSwitched: "Language switched to English.",
    unknown:
      "I didn't get that 🤔\n\n" +
      "Forward an Admas lottery SMS, or use the menu below.\n" +
      "/help for more info.",
  },
} as const;

/* ---------- user language cache ---------- */

const userLang = new Map<string, Lang>();

function getLang(userId: string | number): Lang {
  return userLang.get(String(userId)) ?? "am";
}

function setLang(userId: string | number, lang: Lang) {
  userLang.set(String(userId), lang);
}

function strings(userId: string | number) {
  return t[getLang(userId)];
}

/* ---------- keyboards ---------- */

function mainKeyboard(lang: Lang) {
  const s = t[lang];
  return new Keyboard()
    .text(s.menuTickets)
    .text(s.menuWinners)
    .row()
    .text(s.menuUpgrade)
    .text(s.menuHelp)
    .text(s.menuLang)
    .resized()
    .persistent();
}

/** Pending upgrade plan choice while waiting for screenshot */
const pendingUpgrade = new Map<string, "PLUS" | "PREMIUM">();

/* ---------- API helpers ---------- */

async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-bot-api-secret": apiSecret!,
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function registerUser(
  user: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  },
  language: Lang,
) {
  return apiFetch("/api/users/telegram", {
    method: "POST",
    body: JSON.stringify({
      telegramId: String(user.id),
      telegramUsername: user.username ?? null,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      language,
    }),
  });
}

type TicketDto = {
  ticketNumber: string;
  expirationDateText: string;
  drawDateText: string;
  isChecked?: boolean;
  isWinner?: boolean;
  matchedPrize?: {
    prizeName: string;
    prizeAmount: string | number | null;
    currency: string;
  } | null;
};

async function fetchTickets(telegramId: string) {
  const res = await apiFetch(
    `/api/tickets?telegramId=${encodeURIComponent(telegramId)}`,
  );
  const data = res.data as {
    error?: string;
    tickets?: TicketDto[];
  };
  return { ...res, tickets: data.tickets ?? [] };
}

function formatTicketList(
  tickets: TicketDto[],
  s: (typeof t)["am"],
  winnersOnly = false,
) {
  const list = winnersOnly ? tickets.filter((x) => x.isWinner) : tickets;

  if (list.length === 0) {
    return winnersOnly ? s.noWinners : s.noTickets;
  }

  const header = winnersOnly
    ? s.winnersHeader(list.length)
    : s.ticketsHeader(list.length);

  const body = list.flatMap((ticket, index) => {
    const lines = [
      s.ticketLine(index + 1, ticket.ticketNumber),
      s.expDate(ticket.expirationDateText),
      s.drawDate(ticket.drawDateText),
    ];
    if (ticket.isWinner && ticket.matchedPrize) {
      const amount =
        ticket.matchedPrize.prizeAmount != null
          ? ` (${ticket.matchedPrize.prizeAmount} ${ticket.matchedPrize.currency})`
          : "";
      lines.push(s.winnerLine(ticket.matchedPrize.prizeName, amount));
    } else if (ticket.isChecked) {
      lines.push(s.notWon);
    } else {
      lines.push(s.pending);
    }
    lines.push("");
    return lines;
  });

  return [header, "", ...body].join("\n");
}

/* ---------- SMS parser (single + bulk paste) ---------- */

type PendingTicket = {
  ticketNumber: string;
  originalSms: string;
  expirationDateText: string;
  drawDateText: string;
};

/** User may confirm one or many tickets at once */
const pendingTickets = new Map<string, PendingTicket[]>();

const ethiopianDate =
  "(?:መስከረም|ጥቅምት|ኅዳር|ህዳር|ታኅሣሥ|ታህሳስ|ጥር|የካቲት|መጋቢት|ሚያዝያ|ግንቦት|ሰኔ|ሐምሌ|ነሐሴ|ጳጉሜ)";
const datePattern = new RegExp(
  `${ethiopianDate}\\s+\\d{1,2}/\\d{4}\\s*ዓ\\s*\\.\\s*ም\\.?`,
);

/**
 * Official Admas SMS style (also works when many are pasted together):
 * የእድል ቁጥርዎ 052-0056983 ... የሚያበቃበት ቀን ጥቅምት 21/2019 ዓ.ም ... የሚወጣበት ቀን ጥቅምት 25/2019 ዓ.ም
 */
function parseAllLotterySms(text: string): PendingTicket[] {
  const results: PendingTicket[] = [];
  const seen = new Set<string>();

  // Split bulk paste into chunks around each ticket number when possible
  const ticketRe = /\b(\d{3}-\d{7})\b/g;
  const matches = [...text.matchAll(ticketRe)];
  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const ticketNumber = m[1];
    if (seen.has(ticketNumber)) continue;

    const start = m.index ?? 0;
    const end =
      i + 1 < matches.length && matches[i + 1].index != null
        ? matches[i + 1].index!
        : text.length;
    // Prefer a window that includes markers before the next ticket
    const chunkStart = Math.max(0, start - 80);
    const chunk = text.slice(chunkStart, end);

    const expirationMarker = /(?:ዕጣው|እጣው|እጣዉ|ዕጣዉ)?\s*የሚያበቃበት\s*ቀን/;
    const drawMarker = /(?:ዕጣው|እጣው|እጣዉ|ዕጣዉ)?\s*የሚወጣበት\s*ቀን/;

    let expirationDate: string | undefined;
    let drawDate: string | undefined;

    const expParts = chunk.split(expirationMarker);
    if (expParts.length > 1) {
      expirationDate = expParts[1].match(datePattern)?.[0]?.trim();
    }
    const drawParts = chunk.split(drawMarker);
    if (drawParts.length > 1) {
      drawDate = drawParts[1].match(datePattern)?.[0]?.trim();
    }

    // Fallback: first two Ethiopian dates in this chunk
    if (!expirationDate || !drawDate) {
      const allDates = chunk.match(new RegExp(datePattern, "g"));
      if (allDates && allDates.length >= 2) {
        expirationDate = expirationDate ?? allDates[0].trim();
        drawDate = drawDate ?? allDates[1].trim();
      }
    }

    if (!expirationDate || !drawDate) continue;

    seen.add(ticketNumber);
    results.push({
      ticketNumber,
      originalSms: chunk.trim().slice(0, 2000),
      expirationDateText: expirationDate,
      drawDateText: drawDate,
    });
  }

  return results;
}

/* ---------- commands ---------- */

bot.command("start", async (ctx) => {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("Could not identify your Telegram account.");
    return;
  }

  const lang = getLang(user.id);
  const s = t[lang];

  try {
    const res = await registerUser(user, lang);
    if (!res.ok) {
      console.error("Registration failed:", res.status, res.data);
      await ctx.reply(s.regFail);
      return;
    }

    await ctx.reply(s.welcome(user.first_name), {
      parse_mode: "Markdown",
      reply_markup: mainKeyboard(lang),
    });
  } catch (error) {
    console.error("Could not reach the API:", error);
    await ctx.reply(s.serviceDown);
  }
});

bot.command("help", async (ctx) => {
  const s = strings(ctx.from!.id);
  await ctx.reply(s.help, {
    parse_mode: "Markdown",
    reply_markup: mainKeyboard(getLang(ctx.from!.id)),
  });
});

bot.command("lang", async (ctx) => {
  const id = ctx.from!.id;
  const next: Lang = getLang(id) === "am" ? "en" : "am";
  setLang(id, next);

  // Persist language preference if user is registered
  try {
    await registerUser(
      {
        id,
        username: ctx.from!.username,
        first_name: ctx.from!.first_name,
        last_name: ctx.from!.last_name,
      },
      next,
    );
  } catch {
    // ignore — local switch still works
  }

  const s = t[next];
  await ctx.reply(s.langSwitched, {
    reply_markup: mainKeyboard(next),
  });
});

bot.command("mytickets", async (ctx) => {
  const id = String(ctx.from!.id);
  const s = strings(id);

  try {
    const res = await fetchTickets(id);
    if (!res.ok) {
      console.error("Could not retrieve tickets:", res.status, res.data);
      await ctx.reply(s.loadFail);
      return;
    }
    await ctx.reply(formatTicketList(res.tickets, s), {
      parse_mode: "Markdown",
      reply_markup: mainKeyboard(getLang(id)),
    });
  } catch (error) {
    console.error("My tickets request failed:", error);
    await ctx.reply(s.serviceDown);
  }
});

bot.command("winners", async (ctx) => {
  const id = String(ctx.from!.id);
  const s = strings(id);

  try {
    const res = await fetchTickets(id);
    if (!res.ok) {
      await ctx.reply(s.loadFail);
      return;
    }
    await ctx.reply(formatTicketList(res.tickets, s, true), {
      parse_mode: "Markdown",
      reply_markup: mainKeyboard(getLang(id)),
    });
  } catch (error) {
    console.error("Winners request failed:", error);
    await ctx.reply(s.serviceDown);
  }
});

/* ---------- menu button text handlers ---------- */

bot.hears([/🎟️ ትኬቶቼ/, /🎟️ My tickets/], async (ctx) => {
  await ctx.replyWithChatAction("typing");
  // Reuse command logic
  const id = String(ctx.from!.id);
  const s = strings(id);
  try {
    const res = await fetchTickets(id);
    if (!res.ok) {
      await ctx.reply(s.loadFail);
      return;
    }
    await ctx.reply(formatTicketList(res.tickets, s), {
      parse_mode: "Markdown",
    });
  } catch {
    await ctx.reply(s.serviceDown);
  }
});

bot.hears([/🏆 አሸናፊዎች/, /🏆 Winners/], async (ctx) => {
  const id = String(ctx.from!.id);
  const s = strings(id);
  try {
    const res = await fetchTickets(id);
    if (!res.ok) {
      await ctx.reply(s.loadFail);
      return;
    }
    await ctx.reply(formatTicketList(res.tickets, s, true), {
      parse_mode: "Markdown",
    });
  } catch {
    await ctx.reply(s.serviceDown);
  }
});

bot.hears([/❓ እገዛ/, /❓ Help/], async (ctx) => {
  const s = strings(ctx.from!.id);
  await ctx.reply(s.help, { parse_mode: "Markdown" });
});

bot.hears([/🌐 Language/, /🌐 አማርኛ/], async (ctx) => {
  const id = ctx.from!.id;
  const next: Lang = getLang(id) === "am" ? "en" : "am";
  setLang(id, next);
  try {
    await registerUser(
      {
        id,
        username: ctx.from!.username,
        first_name: ctx.from!.first_name,
        last_name: ctx.from!.last_name,
      },
      next,
    );
  } catch {
    // ignore
  }
  const s = t[next];
  await ctx.reply(s.langSwitched, { reply_markup: mainKeyboard(next) });
});

/* ---------- SMS / free text ---------- */

bot.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  // Let /commands reach bot.command(...) handlers
  if (text.startsWith("/")) {
    return next();
  }

  // Ignore reply-keyboard menu buttons (handled by bot.hears / commands)
  const menuButtons = [
    "🎟️ ትኬቶቼ",
    "🎟️ My tickets",
    "🏆 አሸናፊዎች",
    "🏆 Winners",
    "⭐ አሻሽል",
    "⭐ Upgrade",
    "❓ እገዛ",
    "❓ Help",
    "🌐 Language",
    "🌐 አማርኛ",
  ];
  if (menuButtons.includes(text)) {
    // Handle upgrade here so menu works even if hears order differs
    if (text === "⭐ አሻሽል" || text === "⭐ Upgrade") {
      await showUpgrade(ctx);
    }
    return;
  }

  const s = strings(ctx.from!.id);
  const tickets = parseAllLotterySms(text);

  if (tickets.length === 0) {
    await ctx.reply(s.parseFail, { parse_mode: "Markdown" });
    return;
  }

  const userKey = String(ctx.from!.id);
  pendingTickets.set(userKey, tickets);

  // Auto-expire pending after 10 minutes
  setTimeout(() => pendingTickets.delete(userKey), 10 * 60 * 1000);

  const keyboard = new InlineKeyboard()
    .text(s.btnConfirm, "ticket:confirm")
    .text(s.btnCancel, "ticket:cancel");

  const preview = tickets
    .slice(0, 15)
    .map((t, i) => `${i + 1}. \`${t.ticketNumber}\` — ${t.drawDateText}`)
    .join("\n");
  const more = tickets.length > 15 ? `\n… +${tickets.length - 15} more` : "";

  const lang = getLang(userKey);
  const title =
    tickets.length === 1
      ? s.confirmTitle
      : lang === "en"
        ? `🎟️ Found ${tickets.length} tickets`
        : `🎟️ ${tickets.length} ትኬቶች ተገኝተዋል`;
  const body =
    tickets.length === 1
      ? s.confirmBody(
          tickets[0].ticketNumber,
          tickets[0].expirationDateText,
          tickets[0].drawDateText,
        )
      : (lang === "en" ? "Save all of these?\n\n" : "ሁሉንም እናስቀምጥ?\n\n") +
        preview +
        more;

  await ctx.reply(`${title}\n\n${body}`, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
});

/* ---------- confirm / cancel callbacks ---------- */

bot.callbackQuery("ticket:confirm", async (ctx) => {
  const userKey = String(ctx.from.id);
  const tickets = pendingTickets.get(userKey);
  const s = strings(userKey);
  const lang = getLang(userKey);

  if (!tickets || tickets.length === 0) {
    await ctx.answerCallbackQuery({
      text: s.confirmExpired,
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    lang === "en" ? "Saving tickets…" : "ትኬቶች በመቀመጥ ላይ…",
  );

  let saved = 0;
  let duplicates = 0;
  let failed = 0;
  let limitHit: { used: number; limit: number; plan: string } | null = null;
  let lastUsage: { used: number; limit: number | null } | null = null;

  try {
    for (const ticket of tickets) {
      if (limitHit) break;

      const res = await apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          telegramId: userKey,
          ...ticket,
        }),
      });

      if (res.status === 409) {
        duplicates += 1;
        continue;
      }

      if (res.status === 403) {
        const body = res.data as {
          code?: string;
          plan?: string;
          limit?: number;
          used?: number;
        };
        if (body.code === "TICKET_LIMIT") {
          limitHit = {
            used: body.used ?? 0,
            limit: body.limit ?? 0,
            plan: body.plan ?? "FREE",
          };
          break;
        }
      }

      if (!res.ok) {
        failed += 1;
        console.error("Ticket registration failed:", res.status, res.data);
        continue;
      }

      saved += 1;
      const usage = (
        res.data as { usage?: { used: number; limit: number | null } }
      ).usage;
      if (usage) lastUsage = usage;
    }

    pendingTickets.delete(userKey);

    const lines: string[] = [];
    if (tickets.length === 1 && saved === 1) {
      lines.push(s.saved(tickets[0].ticketNumber, tickets[0].drawDateText));
    } else {
      lines.push(
        lang === "en"
          ? `✅ Saved ${saved} of ${tickets.length} tickets.`
          : `✅ ከ${tickets.length} ትኬቶች ${saved} ተቀምጠዋል።`,
      );
      if (duplicates > 0) {
        lines.push(
          lang === "en"
            ? `ℹ️ ${duplicates} already saved (skipped).`
            : `ℹ️ ${duplicates} ከዚህ በፊት ተቀምጠው ነበር (ተዘልለዋል)።`,
        );
      }
      if (failed > 0) {
        lines.push(
          lang === "en"
            ? `⚠️ ${failed} failed to save.`
            : `⚠️ ${failed} ማስቀመጥ አልተቻለም።`,
        );
      }
    }

    if (limitHit) {
      lines.push("");
      lines.push(s.limitReached(limitHit.used, limitHit.limit, limitHit.plan));
    } else if (lastUsage?.limit != null) {
      lines.push(`\n(${lastUsage.used}/${lastUsage.limit})`);
    }

    await ctx.editMessageText(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Could not reach ticket API:", error);
    await ctx.reply(s.serviceDown);
  }
});

bot.callbackQuery("ticket:cancel", async (ctx) => {
  const userKey = String(ctx.from.id);
  const s = strings(userKey);
  pendingTickets.delete(userKey);
  await ctx.answerCallbackQuery({ text: s.cancelled });
  await ctx.editMessageText(s.cancelled);
});

/* ---------- Upgrade / plan ---------- */

async function showUpgrade(ctx: {
  from?: { id: number } | undefined;
  reply: Function;
}) {
  const id = String(ctx.from!.id);
  const s = strings(id);
  try {
    const res = await apiFetch(`/api/users/telegram/${id}/plan`);
    if (!res.ok) {
      await ctx.reply(s.serviceDown);
      return;
    }
    const data = res.data as {
      plan: string;
      ticketCount: number;
      limit: number | null;
      limitsEnabled: boolean;
      pricing: {
        plusPriceEtb: string;
        premiumPriceEtb: string;
        plusLimit: number;
        premiumLimit: number;
      };
      telebirr: { number: string; name: string };
    };

    const plan = (data.plan || "FREE").toUpperCase();
    const planInfo = s.planInfo(
      plan,
      data.ticketCount,
      data.limit,
      data.limitsEnabled,
    );

    // Premium is top tier — no upgrade options
    if (plan === "PREMIUM") {
      await ctx.reply(
        `${s.upgradeTitle}\n\n${planInfo}\n\n${s.alreadyPremium}`,
        {
          parse_mode: "Markdown",
        },
      );
      return;
    }

    const keyboard = new InlineKeyboard();

    // Free → show Plus + Premium
    // Plus → show Premium only (no Plus again)
    if (plan === "FREE") {
      keyboard
        .text(
          s.btnPlus(data.pricing.plusPriceEtb, data.pricing.plusLimit),
          "upgrade:PLUS",
        )
        .row()
        .text(
          s.btnPremium(data.pricing.premiumPriceEtb, data.pricing.premiumLimit),
          "upgrade:PREMIUM",
        );
    } else {
      // PLUS or anything else below PREMIUM
      keyboard.text(
        s.btnPremium(data.pricing.premiumPriceEtb, data.pricing.premiumLimit),
        "upgrade:PREMIUM",
      );
    }

    const hint = plan === "PLUS" ? s.upgradeOnlyPremium : s.choosePlan;

    await ctx.reply(`${s.upgradeTitle}\n\n${planInfo}\n\n${hint}`, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch {
    await ctx.reply(s.serviceDown);
  }
}

bot.command("upgrade", async (ctx) => {
  await showUpgrade(ctx);
});

bot.hears([/⭐ አሻሽል/, /⭐ Upgrade/], async (ctx) => {
  await showUpgrade(ctx);
});

bot.callbackQuery(/^upgrade:(PLUS|PREMIUM)$/, async (ctx) => {
  const target = ctx.match![1] as "PLUS" | "PREMIUM";
  const id = String(ctx.from.id);
  const s = strings(id);

  await ctx.answerCallbackQuery();

  try {
    const res = await apiFetch(`/api/users/telegram/${id}/plan`);
    const data = res.data as {
      plan: string;
      pricing: { plusPriceEtb: string; premiumPriceEtb: string };
      telebirr: { number: string; name: string };
    };
    const current = (data.plan || "FREE").toUpperCase();

    // Block same-tier or downgrade
    const rank = { FREE: 0, PLUS: 1, PREMIUM: 2 } as const;
    const currentRank = rank[current as keyof typeof rank] ?? 0;
    const targetRank = rank[target];
    if (targetRank <= currentRank) {
      await ctx.editMessageText(s.noDowngrade, { parse_mode: "Markdown" });
      return;
    }

    const price =
      target === "PLUS"
        ? data.pricing.plusPriceEtb
        : data.pricing.premiumPriceEtb;

    pendingUpgrade.set(id, target);
    setTimeout(() => pendingUpgrade.delete(id), 30 * 60 * 1000);

    await ctx.editMessageText(
      s.payInstructions(
        target,
        price,
        data.telebirr?.number ?? "",
        data.telebirr?.name ?? "",
      ) + `\n\n${s.sendScreenshot}`,
      { parse_mode: "Markdown" },
    );
  } catch {
    await ctx.reply(s.serviceDown);
  }
});

bot.on("message:photo", async (ctx) => {
  const id = String(ctx.from.id);
  const s = strings(id);
  const plan = pendingUpgrade.get(id);

  if (!plan) {
    // Ignore random photos unless waiting for payment proof
    return;
  }

  const photos = ctx.message.photo;
  const best = photos[photos.length - 1];
  const fileId = best.file_id;
  const caption = ctx.message.caption?.trim();

  try {
    const res = await apiFetch("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        telegramId: id,
        requestedPlan: plan,
        screenshotFileId: fileId,
        userNote: caption || undefined,
      }),
    });

    if (!res.ok) {
      await ctx.reply(s.paymentFail);
      return;
    }

    pendingUpgrade.delete(id);
    await ctx.reply(s.paymentSubmitted, {
      reply_markup: mainKeyboard(getLang(id)),
    });
  } catch {
    await ctx.reply(s.paymentFail);
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error);
});

/**
 * Render Web Services require an open HTTP port.
 * The bot uses Telegram long-polling; this tiny server only
 * satisfies health checks so the deploy stays alive.
 */
const healthPort = Number(process.env.PORT) || 8080;
createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "admas-bot" }));
}).listen(healthPort, () => {
  console.log(`Bot health server listening on port ${healthPort}`);
});

async function main() {
  // Ensure no webhook is set so long-polling works after deploys
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
  } catch (error) {
    console.warn("deleteWebhook warning:", error);
  }

  await bot.start({
    onStart: (info) => {
      console.log(`Admas Telegram bot is running as @${info.username}`);
    },
  });
}

main().catch((error) => {
  console.error("Bot failed to start:", error);
  process.exit(1);
});
