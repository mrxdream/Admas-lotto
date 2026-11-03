-- CreateTable
CREATE TABLE "lottery_tickets" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "originalSms" TEXT NOT NULL,
    "expirationDateText" TEXT NOT NULL,
    "drawDateText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lottery_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lottery_tickets_telegramUserId_idx" ON "lottery_tickets"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_tickets_telegramUserId_ticketNumber_drawDateText_key" ON "lottery_tickets"("telegramUserId", "ticketNumber", "drawDateText");

-- AddForeignKey
ALTER TABLE "lottery_tickets" ADD CONSTRAINT "lottery_tickets_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
