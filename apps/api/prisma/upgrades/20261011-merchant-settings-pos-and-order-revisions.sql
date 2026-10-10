-- Additive PostgreSQL upgrade for merchant operating settings, POS trials,
-- and customer-approved order revisions. Apply only after an approved backup.
BEGIN;

ALTER TABLE "Merchant"
    ADD COLUMN IF NOT EXISTS "deliveryFeePaisa" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
    ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_deliveryFeePaisa_check"
        CHECK ("deliveryFeePaisa" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MerchantOperatingHours" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT FALSE,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "closesNextDay" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantOperatingHours_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantOperatingHours_merchantId_fkey" FOREIGN KEY ("merchantId")
        REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MerchantOperatingHours_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
    CONSTRAINT "MerchantOperatingHours_schedule_check" CHECK (
        ("isClosed" AND "opensAt" IS NULL AND "closesAt" IS NULL AND NOT "closesNextDay") OR
        (NOT "isClosed" AND "opensAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
         "closesAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantOperatingHours_merchantId_dayOfWeek_key"
    ON "MerchantOperatingHours"("merchantId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "MerchantPosTrial" (
    "userId" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT FALSE,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantPosTrial_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "MerchantPosTrial_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MerchantPosTrial_dates_check" CHECK (
        ("startedAt" IS NULL AND "endsAt" IS NULL) OR
        ("startedAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startedAt")
    )
);

CREATE TABLE IF NOT EXISTS "OrderRevision" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "originalTotalPaisa" INTEGER NOT NULL,
    "proposedTotalPaisa" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "OrderRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderRevision_orderId_fkey" FOREIGN KEY ("orderId")
        REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderRevision_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId")
        REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderRevision_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    CONSTRAINT "OrderRevision_amounts_check" CHECK ("originalTotalPaisa" >= 0 AND "proposedTotalPaisa" >= 0)
);
CREATE INDEX IF NOT EXISTS "OrderRevision_orderId_createdAt_idx"
    ON "OrderRevision"("orderId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderRevision_requestId_key"
    ON "OrderRevision"("requestId");
CREATE INDEX IF NOT EXISTS "OrderRevision_status_expiresAt_idx"
    ON "OrderRevision"("status", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderRevision_one_pending_per_order_key"
    ON "OrderRevision"("orderId") WHERE "status" = 'PENDING';

COMMIT;

-- Rollback (only when no revisions/trial records need preserving):
-- DROP TABLE IF EXISTS "OrderRevision";
-- DROP TABLE IF EXISTS "MerchantPosTrial";
-- DROP TABLE IF EXISTS "MerchantOperatingHours";
-- ALTER TABLE "Merchant" DROP CONSTRAINT IF EXISTS "Merchant_deliveryFeePaisa_check";
-- ALTER TABLE "Merchant" DROP COLUMN IF EXISTS "deliveryFeePaisa";
