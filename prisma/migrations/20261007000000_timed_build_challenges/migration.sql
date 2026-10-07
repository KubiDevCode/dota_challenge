ALTER TABLE "Challenge"
  ADD COLUMN "availableUntil" TIMESTAMPTZ(3),
  ADD COLUMN "requiredHeroId" INTEGER,
  ADD COLUMN "requiredItemIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "PlayerMatchStats"
  ADD COLUMN "itemIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TYPE "ChallengePeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'PERMANENT');
ALTER TABLE "Challenge" ADD COLUMN "period" "ChallengePeriod" NOT NULL DEFAULT 'PERMANENT';
UPDATE "Challenge"
SET "period" = CASE "category"
  WHEN 'Ежедневные' THEN 'DAILY'::"ChallengePeriod"
  WHEN 'Еженедельные' THEN 'WEEKLY'::"ChallengePeriod"
  WHEN 'Ежемесячные' THEN 'MONTHLY'::"ChallengePeriod"
  ELSE 'PERMANENT'::"ChallengePeriod"
END;

ALTER TYPE "UserChallengeStatus" ADD VALUE 'EXPIRED';
ALTER TABLE "UserChallenge"
  ADD COLUMN "periodKey" VARCHAR(16) NOT NULL DEFAULT 'PERMANENT',
  ADD COLUMN "expiresAt" TIMESTAMPTZ(3);
DROP INDEX "UserChallenge_userId_challengeId_key";
CREATE UNIQUE INDEX "UserChallenge_userId_challengeId_periodKey_key"
  ON "UserChallenge"("userId", "challengeId", "periodKey");
