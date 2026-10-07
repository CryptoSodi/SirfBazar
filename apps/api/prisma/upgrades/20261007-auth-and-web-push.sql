-- Additive PostgreSQL upgrade from the previously published API schema.
-- Back up the database and review this script before applying.
BEGIN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cnic" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_cnic_key" ON "User"("cnic");
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "role" TEXT;
CREATE TABLE IF NOT EXISTS "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");
COMMIT;
