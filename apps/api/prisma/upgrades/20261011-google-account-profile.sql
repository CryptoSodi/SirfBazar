-- Additive PostgreSQL upgrade for displaying the verified Google account
-- linked to the current SirfBazar user. Existing Google subjects remain in User.googleId.
BEGIN;
CREATE TABLE IF NOT EXISTS "GoogleAccountProfile" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleAccountProfile_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "GoogleAccountProfile_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
COMMIT;

-- Rollback: DROP TABLE IF EXISTS "GoogleAccountProfile";
-- This removes only the cached display snapshot; User.googleId remains authoritative.
