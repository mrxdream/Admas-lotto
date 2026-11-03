-- AlterTable
ALTER TABLE "lottery_tickets" ADD COLUMN IF NOT EXISTS "isChecked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lottery_tickets" ADD COLUMN IF NOT EXISTS "isWinner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lottery_tickets" ADD COLUMN IF NOT EXISTS "matchedPrizeId" TEXT;
ALTER TABLE "lottery_tickets" ADD COLUMN IF NOT EXISTS "checkedAt" TIMESTAMP(3);
ALTER TABLE "lottery_tickets" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lottery_tickets_drawDateText_idx" ON "lottery_tickets"("drawDateText");
CREATE INDEX IF NOT EXISTS "lottery_tickets_ticketNumber_idx" ON "lottery_tickets"("ticketNumber");
CREATE INDEX IF NOT EXISTS "lottery_tickets_isWinner_idx" ON "lottery_tickets"("isWinner");
CREATE INDEX IF NOT EXISTS "draw_prizes_winningNumber_idx" ON "draw_prizes"("winningNumber");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lottery_tickets_matchedPrizeId_fkey'
  ) THEN
    ALTER TABLE "lottery_tickets"
      ADD CONSTRAINT "lottery_tickets_matchedPrizeId_fkey"
      FOREIGN KEY ("matchedPrizeId") REFERENCES "draw_prizes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;