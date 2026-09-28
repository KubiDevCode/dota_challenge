ALTER TABLE "Match" ALTER COLUMN "duration" DROP NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "matchMode" DROP NOT NULL;
ALTER TABLE "Match" ADD COLUMN "lobbyType" INTEGER;

ALTER TABLE "PlayerMatchStats" ALTER COLUMN "win" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "kills" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "deaths" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "assists" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "lastHits" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "heroDamage" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "towerDamage" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "wardsPlaced" DROP NOT NULL;
ALTER TABLE "PlayerMatchStats" ALTER COLUMN "heroId" DROP NOT NULL;

ALTER TABLE "Match" DROP CONSTRAINT "Match_duration_positive";
ALTER TABLE "Match" ADD CONSTRAINT "Match_duration_positive" CHECK ("duration" IS NULL OR "duration" > 0);
ALTER TABLE "PlayerMatchStats" DROP CONSTRAINT "PlayerMatchStats_nonnegative";
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_nonnegative" CHECK (
  ("kills" IS NULL OR "kills" >= 0) AND ("deaths" IS NULL OR "deaths" >= 0)
  AND ("assists" IS NULL OR "assists" >= 0) AND ("lastHits" IS NULL OR "lastHits" >= 0)
  AND ("heroDamage" IS NULL OR "heroDamage" >= 0) AND ("towerDamage" IS NULL OR "towerDamage" >= 0)
  AND ("wardsPlaced" IS NULL OR "wardsPlaced" >= 0) AND ("heroId" IS NULL OR "heroId" > 0)
  AND ("killParticipation" IS NULL OR "killParticipation" BETWEEN 0 AND 1)
);
