CREATE TABLE "MatchSyncState" (
  "userId" UUID NOT NULL,
  "lastMatchId" VARCHAR(20),
  "lastSuccessfulAt" TIMESTAMPTZ(3),
  CONSTRAINT "MatchSyncState_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "MatchSyncState" ADD CONSTRAINT "MatchSyncState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
