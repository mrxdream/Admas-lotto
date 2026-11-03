import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import { prisma } from "./lib/prisma";
import session from "express-session";
import { timingSafeEqual } from "node:crypto";
const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "20kb" }));
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not configured");
}

app.use(
  session({
    name: "admas.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Local HTTP development only
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "admas-api" });
});

app.get("/health/database", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

const telegramUserSchema = z.object({
  telegramId: z.string().regex(/^\d{1,20}$/),
  telegramUsername: z.string().max(64).nullable().optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().max(100).nullable().optional(),
  language: z.enum(["am", "en"]).default("am"),
});

app.post("/api/users/telegram", async (req, res) => {
  const expectedSecret = process.env.BOT_API_SECRET;
  const suppliedSecret = req.header("x-bot-api-secret");

  if (!expectedSecret) {
    return res.status(503).json({
      error: "Bot registration is not configured",
    });
  }

  if (suppliedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = telegramUserSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid user data",
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const data = parsed.data;

  try {
    const user = await prisma.telegramUser.upsert({
      where: {
        telegramId: BigInt(data.telegramId),
      },
      create: {
        telegramId: BigInt(data.telegramId),
        telegramUsername: data.telegramUsername ?? null,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        language: data.language,
      },
      update: {
        telegramUsername: data.telegramUsername ?? null,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        language: data.language,
      },
    });

    return res.status(200).json({
      message: "Telegram user registered successfully",
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Telegram registration failed:", error);
    return res.status(500).json({
      error: "Could not register user",
    });
  }
});

app.get("/api/tickets", async (req, res) => {
  const expectedSecret = process.env.BOT_API_SECRET;
  const suppliedSecret = req.header("x-bot-api-secret");

  if (!expectedSecret) {
    return res.status(503).json({ error: "Service not configured" });
  }

  if (suppliedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const telegramId = req.query.telegramId;

  if (typeof telegramId !== "string" || !/^\d{1,20}$/.test(telegramId)) {
    return res.status(400).json({ error: "Invalid Telegram ID" });
  }

  try {
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "Active user not found" });
    }

    const tickets = await prisma.lotteryTicket.findMany({
      where: { telegramUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        ticketNumber: true,
        expirationDateText: true,
        drawDateText: true,
        isChecked: true,
        isWinner: true,
        notifiedAt: true,
        createdAt: true,
        matchedPrize: {
          select: {
            prizeName: true,
            prizeAmount: true,
            currency: true,
          },
        },
      },
    });

    return res.json({
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    console.error("Ticket retrieval failed:", error);
    return res.status(500).json({ error: "Could not retrieve tickets" });
  }
});

/* ---------- ADMIN SESSION AUTHENTICATION ---------- */

const safeSecretEqual = (provided: string, expected: string) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

// Login
app.post("/api/admin/auth/login", (req, res) => {
  const schema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Username and password are required",
    });
  }

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return res.status(503).json({
      error: "Admin login is not configured",
    });
  }

  const usernameMatches = safeSecretEqual(
    parsed.data.username,
    expectedUsername,
  );

  const passwordMatches = safeSecretEqual(
    parsed.data.password,
    expectedPassword,
  );

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({
      error: "Invalid username or password",
    });
  }

  // Regenerate the session to reduce session-fixation risk.
  req.session.regenerate((error) => {
    if (error) {
      console.error("Session regeneration failed:", error);

      return res.status(500).json({
        error: "Could not create admin session",
      });
    }

    req.session.adminAuthenticated = true;
    req.session.adminUsername = expectedUsername;

    req.session.save((saveError) => {
      if (saveError) {
        console.error("Session save failed:", saveError);

        return res.status(500).json({
          error: "Could not save admin session",
        });
      }

      return res.json({
        message: "Login successful",
        admin: {
          username: expectedUsername,
        },
      });
    });
  });
});

// Check whether the current browser session is authenticated.
app.get("/api/admin/auth/me", (req, res) => {
  if (!req.session.adminAuthenticated) {
    return res.status(401).json({
      authenticated: false,
    });
  }

  return res.json({
    authenticated: true,
    admin: {
      username: req.session.adminUsername,
    },
  });
});

// Logout
app.post("/api/admin/auth/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Session destruction failed:", error);

      return res.status(500).json({
        error: "Could not log out",
      });
    }

    res.clearCookie("admas.sid", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    return res.json({
      message: "Logged out successfully",
    });
  });
});

/* ---------- ADMIN DRAW MANAGEMENT ---------- */

const adminDrawAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  const suppliedSecret = req.header("x-admin-api-secret");

  if (!expectedSecret) {
    return res.status(503).json({
      error: "Admin API is not configured",
    });
  }

  if (req.session.adminAuthenticated) {
    return next();
  }

  if (suppliedSecret !== expectedSecret) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  return next();
};

// All routes below require the admin secret.
app.use("/api/admin", adminDrawAuth);

// 1. Create a new draft draw.
app.post("/api/admin/draws", async (req, res) => {
  const schema = z.object({
    drawCode: z.string().trim().min(1).max(80),
    drawDateText: z.string().trim().min(1).max(100),
    sourceReference: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid draw information",
      details: parsed.error.issues,
    });
  }

  try {
    const draw = await prisma.lotteryDraw.create({
      data: {
        drawCode: parsed.data.drawCode,
        drawDateText: parsed.data.drawDateText,
        sourceReference: parsed.data.sourceReference,
        notes: parsed.data.notes,
      },
    });

    return res.status(201).json({
      message: "Draft draw created",
      draw,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "A draw with this code already exists",
      });
    }

    console.error("Draw creation failed:", error);
    return res.status(500).json({
      error: "Could not create draw",
    });
  }
});

// 2. List draws and their prize entries.
app.get("/api/admin/draws", async (_req, res) => {
  try {
    const draws = await prisma.lotteryDraw.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        prizes: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return res.json({ count: draws.length, draws });
  } catch (error) {
    console.error("Draw listing failed:", error);
    return res.status(500).json({
      error: "Could not retrieve draws",
    });
  }
});

// 3. Add an official prize entry to a draft draw.

app.post("/api/admin/draws/:drawId/prizes", async (req, res) => {
  const schema = z.object({
    prizeName: z.string().trim().min(1).max(100),
    winningNumber: z.string().trim().min(1).max(100),

    // Accept numbers from the frontend, then normalize them to strings.
    // Prisma can store the string in its Decimal field.
    prizeAmount: z.preprocess(
      (value) => (typeof value === "number" ? String(value) : value),
      z
        .string()
        .trim()
        .regex(
          /^\d{1,10}(\.\d{1,2})?$/,
          "Prize amount must be non-negative with up to 2 decimal places.",
        )
        .optional(),
    ),

    currency: z.string().trim().length(3).default("ETB"),
    sortOrder: z.number().int().min(0).default(0),
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid prize information",
      details: parsed.error.issues,
    });
  }

  try {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: req.params.drawId },
      select: { id: true, status: true },
    });

    if (!draw) {
      return res.status(404).json({
        error: "Draw not found",
      });
    }

    if (draw.status !== "DRAFT") {
      return res.status(409).json({
        error: "Only draft draws can be edited",
      });
    }

    // A draw can have a maximum of 10 prize entries.
    const existingPrizeCount = await prisma.drawPrize.count({
      where: { drawId: draw.id },
    });

    if (existingPrizeCount >= 10) {
      return res.status(409).json({
        error: "This draw already has the maximum of 10 prize entries.",
      });
    }

    const prize = await prisma.drawPrize.create({
      data: {
        drawId: draw.id,
        prizeName: parsed.data.prizeName,
        winningNumber: parsed.data.winningNumber,
        prizeAmount: parsed.data.prizeAmount ?? null,
        currency: parsed.data.currency,
        sortOrder: parsed.data.sortOrder,
      },
    });

    return res.status(201).json({
      message: "Prize entry added successfully",
      prize,
      remainingPrizeEntries: 9 - existingPrizeCount,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "This prize entry already exists for the draw",
      });
    }

    console.error("Prize creation failed:", error);

    return res.status(500).json({
      error: "Could not add prize entry",
    });
  }
});

// 4. Delete a prize entry (draft draws only)
app.delete("/api/admin/draws/:drawId/prizes/:prizeId", async (req, res) => {
  try {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: req.params.drawId },
      select: { id: true, status: true },
    });

    if (!draw) {
      return res.status(404).json({ error: "Draw not found" });
    }

    if (draw.status !== "DRAFT") {
      return res.status(409).json({
        error: "Only draft draws can be edited",
      });
    }

    const prize = await prisma.drawPrize.findFirst({
      where: { id: req.params.prizeId, drawId: draw.id },
    });

    if (!prize) {
      return res.status(404).json({ error: "Prize entry not found" });
    }

    await prisma.drawPrize.delete({ where: { id: prize.id } });

    return res.json({ message: "Prize entry deleted" });
  } catch (error) {
    console.error("Prize deletion failed:", error);
    return res.status(500).json({ error: "Could not delete prize entry" });
  }
});

// 5. Verify a draft draw (DRAFT → VERIFIED)
app.post("/api/admin/draws/:drawId/verify", async (req, res) => {
  try {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: req.params.drawId },
      include: { prizes: true },
    });

    if (!draw) {
      return res.status(404).json({ error: "Draw not found" });
    }

    if (draw.status !== "DRAFT") {
      return res.status(409).json({
        error: `Draw is already ${draw.status.toLowerCase()}`,
      });
    }

    if (draw.prizes.length === 0) {
      return res.status(409).json({
        error: "Add at least one prize entry before verifying",
      });
    }

    const updated = await prisma.lotteryDraw.update({
      where: { id: draw.id },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
      include: {
        prizes: { orderBy: { sortOrder: "asc" } },
      },
    });

    return res.json({
      message: "Draw verified",
      draw: updated,
    });
  } catch (error) {
    console.error("Draw verification failed:", error);
    return res.status(500).json({ error: "Could not verify draw" });
  }
});

// 6. Publish a verified draw (VERIFIED → PUBLISHED) + match + notify
app.post("/api/admin/draws/:drawId/publish", async (req, res) => {
  try {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: req.params.drawId },
      include: { prizes: true },
    });

    if (!draw) {
      return res.status(404).json({ error: "Draw not found" });
    }

    if (draw.status === "PUBLISHED") {
      return res.status(409).json({ error: "Draw is already published" });
    }

    if (draw.status !== "VERIFIED") {
      return res.status(409).json({
        error: "Only verified draws can be published. Verify the draw first.",
      });
    }

    if (draw.prizes.length === 0) {
      return res.status(409).json({
        error: "Draw has no prize entries",
      });
    }

    const { publishDrawResults } = await import("./lib/matching");
    const matchResult = await publishDrawResults(draw.id);

    const updated = await prisma.lotteryDraw.update({
      where: { id: draw.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      include: {
        prizes: { orderBy: { sortOrder: "asc" } },
      },
    });

    return res.json({
      message: "Draw published, tickets matched, and winners notified",
      draw: updated,
      matching: {
        ticketsChecked: matchResult.ticketsChecked,
        winnersFound: matchResult.winnersFound,
        notificationsSent: matchResult.notificationsSent,
      },
    });
  } catch (error) {
    console.error("Draw publish failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not publish draw",
    });
  }
});

// 7. Re-run matching + notifications for an already published draw
app.post("/api/admin/draws/:drawId/match", async (req, res) => {
  try {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: req.params.drawId },
    });

    if (!draw) {
      return res.status(404).json({ error: "Draw not found" });
    }

    if (draw.status !== "PUBLISHED") {
      return res.status(409).json({
        error: "Matching is only available for published draws",
      });
    }

    const { publishDrawResults } = await import("./lib/matching");
    const matchResult = await publishDrawResults(draw.id);

    return res.json({
      message: "Matching completed",
      matching: {
        ticketsChecked: matchResult.ticketsChecked,
        winnersFound: matchResult.winnersFound,
        notificationsSent: matchResult.notificationsSent,
        winners: matchResult.winners,
      },
    });
  } catch (error) {
    console.error("Matching failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not match tickets",
    });
  }
});

// 8. List winners for a draw
app.get("/api/admin/draws/:drawId/winners", async (req, res) => {
  try {
    const draw = await prisma.lotteryDraw.findUnique({
      where: { id: req.params.drawId },
      select: { id: true, drawCode: true, drawDateText: true, status: true },
    });

    if (!draw) {
      return res.status(404).json({ error: "Draw not found" });
    }

    const winners = await prisma.lotteryTicket.findMany({
      where: {
        isWinner: true,
        matchedPrize: { drawId: draw.id },
      },
      include: {
        user: {
          select: {
            telegramId: true,
            telegramUsername: true,
            firstName: true,
            lastName: true,
          },
        },
        matchedPrize: {
          select: {
            prizeName: true,
            winningNumber: true,
            prizeAmount: true,
            currency: true,
          },
        },
      },
      orderBy: { checkedAt: "asc" },
    });

    return res.json({
      draw,
      count: winners.length,
      winners: winners.map((w) => ({
        ticketId: w.id,
        ticketNumber: w.ticketNumber,
        notifiedAt: w.notifiedAt,
        user: {
          telegramId: w.user.telegramId.toString(),
          telegramUsername: w.user.telegramUsername,
          firstName: w.user.firstName,
          lastName: w.user.lastName,
        },
        prize: w.matchedPrize,
      })),
    });
  } catch (error) {
    console.error("Winners listing failed:", error);
    return res.status(500).json({ error: "Could not list winners" });
  }
});

// 9. List all tickets (admin)
app.get("/api/admin/tickets", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const winnersOnly = req.query.winnersOnly === "true";

  try {
    const where = winnersOnly ? { isWinner: true } : {};

    const [tickets, total] = await Promise.all([
      prisma.lotteryTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
            },
          },
          matchedPrize: {
            select: {
              prizeName: true,
              prizeAmount: true,
              currency: true,
            },
          },
        },
      }),
      prisma.lotteryTicket.count({ where }),
    ]);

    return res.json({
      total,
      count: tickets.length,
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        drawDateText: t.drawDateText,
        expirationDateText: t.expirationDateText,
        isChecked: t.isChecked,
        isWinner: t.isWinner,
        checkedAt: t.checkedAt,
        notifiedAt: t.notifiedAt,
        createdAt: t.createdAt,
        user: {
          telegramId: t.user.telegramId.toString(),
          telegramUsername: t.user.telegramUsername,
          firstName: t.user.firstName,
          lastName: t.user.lastName,
        },
        prize: t.matchedPrize,
      })),
    });
  } catch (error) {
    console.error("Ticket listing failed:", error);
    return res.status(500).json({ error: "Could not list tickets" });
  }
});

// 10. List Telegram users (admin)
app.get("/api/admin/users", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  try {
    const [users, total] = await Promise.all([
      prisma.telegramUser.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { tickets: true } },
        },
      }),
      prisma.telegramUser.count(),
    ]);

    return res.json({
      total,
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        telegramId: u.telegramId.toString(),
        telegramUsername: u.telegramUsername,
        firstName: u.firstName,
        lastName: u.lastName,
        language: u.language,
        isActive: u.isActive,
        plan: u.plan,
        planExpiresAt: u.planExpiresAt,
        ticketCount: u._count.tickets,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("User listing failed:", error);
    return res.status(500).json({ error: "Could not list users" });
  }
});

// 11. Overview stats for admin dashboard
app.get("/api/admin/stats", async (_req, res) => {
  try {
    const [
      userCount,
      ticketCount,
      winnerCount,
      draftCount,
      verifiedCount,
      publishedCount,
    ] = await Promise.all([
      prisma.telegramUser.count(),
      prisma.lotteryTicket.count(),
      prisma.lotteryTicket.count({ where: { isWinner: true } }),
      prisma.lotteryDraw.count({ where: { status: "DRAFT" } }),
      prisma.lotteryDraw.count({ where: { status: "VERIFIED" } }),
      prisma.lotteryDraw.count({ where: { status: "PUBLISHED" } }),
    ]);

    return res.json({
      users: userCount,
      tickets: ticketCount,
      winners: winnerCount,
      draws: {
        draft: draftCount,
        verified: verifiedCount,
        published: publishedCount,
        total: draftCount + verifiedCount + publishedCount,
      },
    });
  } catch (error) {
    console.error("Stats failed:", error);
    return res.status(500).json({ error: "Could not load stats" });
  }
});

// 12. Activity feed (derived from real data — tickets, winners, draws)
app.get("/api/admin/activity", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 100);

  try {
    const [recentTickets, recentWinners, recentDraws] = await Promise.all([
      prisma.lotteryTicket.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              telegramUsername: true,
              telegramId: true,
            },
          },
        },
      }),
      prisma.lotteryTicket.findMany({
        where: { isWinner: true, checkedAt: { not: null } },
        orderBy: { checkedAt: "desc" },
        take: limit,
        include: {
          user: {
            select: { firstName: true, telegramUsername: true },
          },
          matchedPrize: {
            select: { prizeName: true, prizeAmount: true, currency: true },
          },
        },
      }),
      prisma.lotteryDraw.findMany({
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          drawCode: true,
          status: true,
          verifiedAt: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    type ActivityItem = {
      id: string;
      type:
        | "ticket_saved"
        | "winner"
        | "draw_created"
        | "draw_verified"
        | "draw_published";
      title: string;
      detail: string;
      at: string;
    };

    const items: ActivityItem[] = [];

    for (const t of recentTickets) {
      const who =
        t.user.firstName ||
        t.user.telegramUsername ||
        t.user.telegramId.toString();
      items.push({
        id: `ticket-${t.id}`,
        type: "ticket_saved",
        title: "Ticket saved",
        detail: `${who} saved ticket ${t.ticketNumber} (${t.drawDateText})`,
        at: t.createdAt.toISOString(),
      });
    }

    for (const w of recentWinners) {
      const who = w.user.firstName || w.user.telegramUsername || "User";
      const prize = w.matchedPrize
        ? `${w.matchedPrize.prizeName}${
            w.matchedPrize.prizeAmount != null
              ? ` — ${w.matchedPrize.prizeAmount} ${w.matchedPrize.currency}`
              : ""
          }`
        : "prize";
      items.push({
        id: `winner-${w.id}`,
        type: "winner",
        title: "Winner matched",
        detail: `${who} won with ${w.ticketNumber}: ${prize}`,
        at: (w.checkedAt ?? w.updatedAt).toISOString(),
      });
    }

    for (const d of recentDraws) {
      if (d.publishedAt) {
        items.push({
          id: `pub-${d.id}`,
          type: "draw_published",
          title: "Draw published",
          detail: `${d.drawCode} is live — tickets matched and winners notified`,
          at: d.publishedAt.toISOString(),
        });
      }
      if (d.verifiedAt) {
        items.push({
          id: `ver-${d.id}`,
          type: "draw_verified",
          title: "Draw verified",
          detail: `${d.drawCode} marked verified and ready to publish`,
          at: d.verifiedAt.toISOString(),
        });
      }
      items.push({
        id: `draw-${d.id}`,
        type: "draw_created",
        title: "Draw created",
        detail: `${d.drawCode} created as ${d.status}`,
        at: d.createdAt.toISOString(),
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1));

    return res.json({
      count: Math.min(items.length, limit),
      activity: items.slice(0, limit),
    });
  } catch (error) {
    console.error("Activity feed failed:", error);
    return res.status(500).json({ error: "Could not load activity" });
  }
});

// 13. Health + session info for Settings
app.get("/api/admin/settings", async (req, res) => {
  try {
    let database: "connected" | "unavailable" = "unavailable";
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "unavailable";
    }

    return res.json({
      admin: {
        username: req.session.adminUsername ?? "admin",
        authenticated: Boolean(req.session.adminAuthenticated),
      },
      service: {
        name: "admas-api",
        database,
        botTokenConfigured: Boolean(process.env.BOT_TOKEN),
        sessionConfigured: Boolean(process.env.SESSION_SECRET),
      },
    });
  } catch (error) {
    console.error("Settings failed:", error);
    return res.status(500).json({ error: "Could not load settings" });
  }
});

/* ---------- BOT TICKET SAVE (with optional plan limits) ---------- */

const ticketSchema = z.object({
  telegramId: z.string().regex(/^\d{1,20}$/),
  ticketNumber: z.string().regex(/^\d{3}-\d{7}$/),
  originalSms: z.string().trim().min(1).max(10000),
  expirationDateText: z.string().trim().min(1).max(100),
  drawDateText: z.string().trim().min(1).max(100),
});

app.post("/api/tickets", async (req, res) => {
  const expectedSecret = process.env.BOT_API_SECRET;
  const suppliedSecret = req.header("x-bot-api-secret");

  if (!expectedSecret) {
    return res.status(503).json({ error: "Service not configured" });
  }

  if (suppliedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = ticketSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid ticket data",
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const data = parsed.data;

  try {
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: BigInt(data.telegramId) },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        error: "Active Telegram user not found. Send /start first.",
      });
    }

    const { getSettings, limitForPlan, effectivePlan } =
      await import("./lib/settings");
    const settings = await getSettings();
    const plan = effectivePlan(
      user.plan as "FREE" | "PLUS" | "PREMIUM",
      user.planExpiresAt,
    );
    const ticketCount = await prisma.lotteryTicket.count({
      where: { telegramUserId: user.id },
    });

    if (settings.limitsEnabled) {
      const limit = limitForPlan(settings, plan);
      if (ticketCount >= limit) {
        return res.status(403).json({
          error: "Ticket limit reached",
          code: "TICKET_LIMIT",
          plan,
          limit,
          used: ticketCount,
          limitsEnabled: true,
          upgrade: {
            plusLimit: settings.plusTicketLimit,
            premiumLimit: settings.premiumTicketLimit,
            plusPriceEtb: settings.plusPriceEtb,
            premiumPriceEtb: settings.premiumPriceEtb,
            telebirrNumber: settings.telebirrNumber,
            telebirrName: settings.telebirrName,
          },
        });
      }
    }

    const ticket = await prisma.lotteryTicket.create({
      data: {
        telegramUserId: user.id,
        ticketNumber: data.ticketNumber,
        originalSms: data.originalSms,
        expirationDateText: data.expirationDateText,
        drawDateText: data.drawDateText,
      },
    });

    return res.status(201).json({
      message: "Ticket saved successfully",
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        expirationDateText: ticket.expirationDateText,
        drawDateText: ticket.drawDateText,
        createdAt: ticket.createdAt,
      },
      usage: {
        plan,
        used: ticketCount + 1,
        limit: settings.limitsEnabled ? limitForPlan(settings, plan) : null,
        limitsEnabled: settings.limitsEnabled,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "This ticket has already been saved for this draw.",
      });
    }

    console.error("Ticket save failed:", error);
    return res.status(500).json({ error: "Could not save ticket" });
  }
});

/* ---------- BOT: plan / upgrade info & payment proof ---------- */

app.get("/api/users/telegram/:telegramId/plan", async (req, res) => {
  const expectedSecret = process.env.BOT_API_SECRET;
  if (req.header("x-bot-api-secret") !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { getSettings, limitForPlan, effectivePlan } =
      await import("./lib/settings");
    const settings = await getSettings();
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: BigInt(req.params.telegramId) },
      include: { _count: { select: { tickets: true } } },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const plan = effectivePlan(
      user.plan as "FREE" | "PLUS" | "PREMIUM",
      user.planExpiresAt,
    );

    return res.json({
      plan,
      planExpiresAt: user.planExpiresAt,
      ticketCount: user._count.tickets,
      limit: settings.limitsEnabled ? limitForPlan(settings, plan) : null,
      limitsEnabled: settings.limitsEnabled,
      pricing: {
        plusPriceEtb: settings.plusPriceEtb,
        premiumPriceEtb: settings.premiumPriceEtb,
        plusLimit: settings.plusTicketLimit,
        premiumLimit: settings.premiumTicketLimit,
        freeLimit: settings.freeTicketLimit,
      },
      telebirr: {
        number: settings.telebirrNumber,
        name: settings.telebirrName,
      },
      upgradeInfoAm: settings.upgradeInfoAm,
      upgradeInfoEn: settings.upgradeInfoEn,
    });
  } catch (error) {
    console.error("Plan info failed:", error);
    return res.status(500).json({ error: "Could not load plan" });
  }
});

app.post("/api/payments", async (req, res) => {
  const expectedSecret = process.env.BOT_API_SECRET;
  if (req.header("x-bot-api-secret") !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const schema = z.object({
    telegramId: z.string().regex(/^\d{1,20}$/),
    requestedPlan: z.enum(["PLUS", "PREMIUM"]),
    screenshotFileId: z.string().min(1).max(500).optional(),
    userNote: z.string().max(1000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payment data" });
  }

  try {
    const { getSettings } = await import("./lib/settings");
    const settings = await getSettings();
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId: BigInt(parsed.data.telegramId) },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found" });
    }

    const { effectivePlan } = await import("./lib/settings");
    const current = effectivePlan(
      user.plan as "FREE" | "PLUS" | "PREMIUM",
      user.planExpiresAt,
    );
    const rank = { FREE: 0, PLUS: 1, PREMIUM: 2 } as const;
    if (rank[parsed.data.requestedPlan] <= rank[current]) {
      return res.status(400).json({
        error: "Already on this plan or higher",
        code: "PLAN_NOT_UPGRADE",
        currentPlan: current,
        requestedPlan: parsed.data.requestedPlan,
      });
    }

    const amount =
      parsed.data.requestedPlan === "PLUS"
        ? settings.plusPriceEtb
        : settings.premiumPriceEtb;

    const payment = await prisma.paymentRequest.create({
      data: {
        telegramUserId: user.id,
        requestedPlan: parsed.data.requestedPlan,
        amountEtb: amount,
        screenshotFileId: parsed.data.screenshotFileId ?? null,
        userNote: parsed.data.userNote ?? null,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      message: "Payment request submitted",
      payment: {
        id: payment.id,
        requestedPlan: payment.requestedPlan,
        amountEtb: payment.amountEtb.toString(),
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Payment submit failed:", error);
    return res.status(500).json({ error: "Could not submit payment" });
  }
});

/* ---------- ADMIN: monetization settings & payments ---------- */

app.get("/api/admin/monetization", async (_req, res) => {
  try {
    const { getSettings } = await import("./lib/settings");
    const settings = await getSettings();
    return res.json({ settings });
  } catch (error) {
    console.error("Monetization settings failed:", error);
    return res.status(500).json({ error: "Could not load settings" });
  }
});

app.put("/api/admin/monetization", async (req, res) => {
  const schema = z.object({
    limitsEnabled: z.boolean().optional(),
    freeTicketLimit: z.number().int().min(0).max(10000).optional(),
    plusTicketLimit: z.number().int().min(0).max(10000).optional(),
    premiumTicketLimit: z.number().int().min(0).max(10000).optional(),
    plusPriceEtb: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional(),
    premiumPriceEtb: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional(),
    telebirrNumber: z.string().max(40).optional(),
    telebirrName: z.string().max(120).optional(),
    upgradeInfoAm: z.string().max(4000).nullable().optional(),
    upgradeInfoEn: z.string().max(4000).nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid settings",
      details: parsed.error.issues,
    });
  }

  try {
    const data = parsed.data;
    const updated = await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        limitsEnabled: data.limitsEnabled ?? false,
        freeTicketLimit: data.freeTicketLimit ?? 5,
        plusTicketLimit: data.plusTicketLimit ?? 15,
        premiumTicketLimit: data.premiumTicketLimit ?? 30,
        plusPriceEtb: data.plusPriceEtb ?? "5",
        premiumPriceEtb: data.premiumPriceEtb ?? "15",
        telebirrNumber: data.telebirrNumber ?? "",
        telebirrName: data.telebirrName ?? "",
        upgradeInfoAm: data.upgradeInfoAm ?? null,
        upgradeInfoEn: data.upgradeInfoEn ?? null,
      },
      update: {
        ...(data.limitsEnabled !== undefined && {
          limitsEnabled: data.limitsEnabled,
        }),
        ...(data.freeTicketLimit !== undefined && {
          freeTicketLimit: data.freeTicketLimit,
        }),
        ...(data.plusTicketLimit !== undefined && {
          plusTicketLimit: data.plusTicketLimit,
        }),
        ...(data.premiumTicketLimit !== undefined && {
          premiumTicketLimit: data.premiumTicketLimit,
        }),
        ...(data.plusPriceEtb !== undefined && {
          plusPriceEtb: data.plusPriceEtb,
        }),
        ...(data.premiumPriceEtb !== undefined && {
          premiumPriceEtb: data.premiumPriceEtb,
        }),
        ...(data.telebirrNumber !== undefined && {
          telebirrNumber: data.telebirrNumber,
        }),
        ...(data.telebirrName !== undefined && {
          telebirrName: data.telebirrName,
        }),
        ...(data.upgradeInfoAm !== undefined && {
          upgradeInfoAm: data.upgradeInfoAm,
        }),
        ...(data.upgradeInfoEn !== undefined && {
          upgradeInfoEn: data.upgradeInfoEn,
        }),
      },
    });

    return res.json({
      message: "Monetization settings saved",
      settings: {
        limitsEnabled: updated.limitsEnabled,
        freeTicketLimit: updated.freeTicketLimit,
        plusTicketLimit: updated.plusTicketLimit,
        premiumTicketLimit: updated.premiumTicketLimit,
        plusPriceEtb: updated.plusPriceEtb.toString(),
        premiumPriceEtb: updated.premiumPriceEtb.toString(),
        telebirrNumber: updated.telebirrNumber,
        telebirrName: updated.telebirrName,
        upgradeInfoAm: updated.upgradeInfoAm,
        upgradeInfoEn: updated.upgradeInfoEn,
      },
    });
  } catch (error) {
    console.error("Save monetization settings failed:", error);
    return res.status(500).json({ error: "Could not save settings" });
  }
});

/** Resolve Telegram screenshot for a payment (admin can see the real image). */
app.get("/api/admin/payments/:id/screenshot", async (req, res) => {
  try {
    const payment = await prisma.paymentRequest.findUnique({
      where: { id: req.params.id },
      select: { screenshotFileId: true },
    });

    if (!payment?.screenshotFileId) {
      return res.status(404).json({ error: "No screenshot for this payment" });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return res.status(503).json({ error: "BOT_TOKEN not configured" });
    }

    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(payment.screenshotFileId)}`,
    );
    const fileJson = (await fileRes.json()) as {
      ok: boolean;
      result?: { file_path?: string };
      description?: string;
    };

    if (!fileJson.ok || !fileJson.result?.file_path) {
      return res.status(502).json({
        error:
          fileJson.description || "Could not resolve screenshot from Telegram",
      });
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileJson.result.file_path}`;

    // Proxy the image so the browser does not need the bot token
    const imgRes = await fetch(fileUrl);
    if (!imgRes.ok) {
      return res.status(502).json({ error: "Could not download screenshot" });
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(buffer);
  } catch (error) {
    console.error("Screenshot fetch failed:", error);
    return res.status(500).json({ error: "Could not load screenshot" });
  }
});

app.get("/api/admin/payments", async (req, res) => {
  const status = req.query.status as string | undefined;
  const where =
    status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
      ? { status: status as "PENDING" | "APPROVED" | "REJECTED" }
      : {};

  try {
    const payments = await prisma.paymentRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            telegramId: true,
            telegramUsername: true,
            firstName: true,
            lastName: true,
            plan: true,
            planExpiresAt: true,
          },
        },
      },
    });

    return res.json({
      count: payments.length,
      payments: payments.map((p) => ({
        id: p.id,
        requestedPlan: p.requestedPlan,
        amountEtb: p.amountEtb.toString(),
        screenshotFileId: p.screenshotFileId,
        userNote: p.userNote,
        status: p.status,
        adminNote: p.adminNote,
        reviewedAt: p.reviewedAt,
        reviewedBy: p.reviewedBy,
        createdAt: p.createdAt,
        user: {
          telegramId: p.user.telegramId.toString(),
          telegramUsername: p.user.telegramUsername,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          plan: p.user.plan,
          planExpiresAt: p.user.planExpiresAt,
        },
      })),
    });
  } catch (error) {
    console.error("List payments failed:", error);
    return res.status(500).json({ error: "Could not list payments" });
  }
});

app.post("/api/admin/payments/:id/review", async (req, res) => {
  const schema = z.object({
    action: z.enum(["APPROVE", "REJECT"]),
    adminNote: z.string().max(1000).optional(),
    /** Days of access when approving. Default 30. */
    durationDays: z.number().int().min(1).max(366).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid review data" });
  }

  try {
    const payment = await prisma.paymentRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.status !== "PENDING") {
      return res.status(409).json({
        error: `Payment already ${payment.status.toLowerCase()}`,
      });
    }

    const reviewer = req.session.adminUsername ?? "admin";

    if (parsed.data.action === "REJECT") {
      const updated = await prisma.paymentRequest.update({
        where: { id: payment.id },
        data: {
          status: "REJECTED",
          adminNote: parsed.data.adminNote ?? null,
          reviewedAt: new Date(),
          reviewedBy: reviewer,
        },
      });
      return res.json({ message: "Payment rejected", payment: updated });
    }

    // APPROVE — upgrade user plan
    const days = parsed.data.durationDays ?? 30;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);

    const [updatedPayment] = await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: payment.id },
        data: {
          status: "APPROVED",
          adminNote: parsed.data.adminNote ?? null,
          reviewedAt: new Date(),
          reviewedBy: reviewer,
        },
      }),
      prisma.telegramUser.update({
        where: { id: payment.telegramUserId },
        data: {
          plan: payment.requestedPlan,
          planExpiresAt: expires,
        },
      }),
    ]);

    // Best-effort Telegram notification
    const botToken = process.env.BOT_TOKEN;
    if (botToken) {
      const text =
        `✅ ክፍያዎ ተረጋግጧል!\n\n` +
        `ዕቅድ: ${payment.requestedPlan}\n` +
        `የሚያበቃበት: ${expires.toLocaleDateString()}\n\n` +
        `አሁን ተጨማሪ ትኬቶችን ማስቀመጥ ይችላሉ።`;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: payment.user.telegramId.toString(),
            text,
          }),
        });
      } catch (e) {
        console.error("Could not notify user of approval:", e);
      }
    }

    return res.json({
      message: "Payment approved — user upgraded",
      payment: updatedPayment,
      plan: payment.requestedPlan,
      planExpiresAt: expires.toISOString(),
    });
  } catch (error) {
    console.error("Payment review failed:", error);
    return res.status(500).json({ error: "Could not review payment" });
  }
});

/** Admin can manually set a user's plan (without payment). */
app.patch("/api/admin/users/:id/plan", async (req, res) => {
  const schema = z.object({
    plan: z.enum(["FREE", "PLUS", "PREMIUM"]),
    planExpiresAt: z.string().datetime().nullable().optional(),
    durationDays: z.number().int().min(1).max(366).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid plan data" });
  }

  try {
    let expires: Date | null = null;
    if (parsed.data.plan !== "FREE") {
      if (parsed.data.planExpiresAt) {
        expires = new Date(parsed.data.planExpiresAt);
      } else {
        expires = new Date();
        expires.setDate(expires.getDate() + (parsed.data.durationDays ?? 30));
      }
    }

    const user = await prisma.telegramUser.update({
      where: { id: req.params.id },
      data: {
        plan: parsed.data.plan,
        planExpiresAt: expires,
      },
    });

    return res.json({
      message: "Plan updated",
      user: {
        id: user.id,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
      },
    });
  } catch (error) {
    console.error("Plan update failed:", error);
    return res.status(500).json({ error: "Could not update plan" });
  }
});

app.listen(port, () => {
  console.log(`Admas API running at http://localhost:${port}`);
});
