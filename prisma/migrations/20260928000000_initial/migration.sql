-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";


-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ChallengeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ChallengeMode" AS ENUM ('PERSISTENT', 'SINGLE_MATCH');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RuleMetric" AS ENUM ('win', 'kills', 'deaths', 'assists', 'killParticipation', 'lastHits', 'heroDamage', 'towerDamage', 'wardsPlaced', 'duration', 'heroId');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('EQ', 'GTE', 'LTE');

-- CreateEnum
CREATE TYPE "UserChallengeStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PASS', 'FAIL', 'PENDING');

-- CreateEnum
CREATE TYPE "MatchProvider" AS ENUM ('STRATZ');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "steamId64" VARCHAR(20) NOT NULL,
    "accountId32" BIGINT NOT NULL,
    "displayName" VARCHAR(128) NOT NULL,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelThreshold" (
    "level" INTEGER NOT NULL,
    "requiredTotalXp" INTEGER NOT NULL,
    "rankName" VARCHAR(128) NOT NULL,

    CONSTRAINT "LevelThreshold_pkey" PRIMARY KEY ("level")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "difficulty" "ChallengeDifficulty" NOT NULL,
    "mode" "ChallengeMode" NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "seasonPointsReward" INTEGER NOT NULL DEFAULT 0,
    "allowedMatchModes" INTEGER[],
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "availableFrom" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRule" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "metric" "RuleMetric" NOT NULL,
    "operator" "RuleOperator" NOT NULL,
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,

    CONSTRAINT "ChallengeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "UserChallengeStatus" NOT NULL DEFAULT 'ACTIVE',
    "attemptsChecked" INTEGER NOT NULL DEFAULT 0,
    "completedByMatchId" VARCHAR(20),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" VARCHAR(20) NOT NULL,
    "provider" "MatchProvider" NOT NULL DEFAULT 'STRATZ',
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "matchMode" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchStats" (
    "matchId" VARCHAR(20) NOT NULL,
    "userId" UUID NOT NULL,
    "win" BOOLEAN NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "killParticipation" DOUBLE PRECISION,
    "lastHits" INTEGER NOT NULL,
    "heroDamage" INTEGER NOT NULL,
    "towerDamage" INTEGER NOT NULL,
    "wardsPlaced" INTEGER NOT NULL,
    "heroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlayerMatchStats_pkey" PRIMARY KEY ("matchId","userId")
);

-- CreateTable
CREATE TABLE "ChallengeEvaluation" (
    "id" UUID NOT NULL,
    "userChallengeId" UUID NOT NULL,
    "matchId" VARCHAR(20) NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "explanation" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChallengeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonScore" (
    "userId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SeasonScore_pkey" PRIMARY KEY ("userId","seasonId")
);

-- CreateTable
CREATE TABLE "RewardLedger" (
    "userChallengeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seasonId" UUID,
    "xp" INTEGER NOT NULL,
    "seasonPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLedger_pkey" PRIMARY KEY ("userChallengeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId64_key" ON "User"("steamId64");

-- CreateIndex
CREATE UNIQUE INDEX "User_accountId32_key" ON "User"("accountId32");

-- CreateIndex
CREATE UNIQUE INDEX "LevelThreshold_requiredTotalXp_key" ON "LevelThreshold"("requiredTotalXp");

-- CreateIndex
CREATE INDEX "Challenge_publicationStatus_availableFrom_idx" ON "Challenge"("publicationStatus", "availableFrom");

-- CreateIndex
CREATE INDEX "ChallengeRule_challengeId_idx" ON "ChallengeRule"("challengeId");

-- CreateIndex
CREATE INDEX "UserChallenge_userId_status_activatedAt_idx" ON "UserChallenge"("userId", "status", "activatedAt");

-- CreateIndex
CREATE INDEX "UserChallenge_challengeId_idx" ON "UserChallenge"("challengeId");

-- CreateIndex
CREATE INDEX "UserChallenge_completedByMatchId_idx" ON "UserChallenge"("completedByMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserChallenge_userId_challengeId_key" ON "UserChallenge"("userId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserChallenge_id_userId_key" ON "UserChallenge"("id", "userId");

-- CreateIndex
CREATE INDEX "PlayerMatchStats_userId_matchId_idx" ON "PlayerMatchStats"("userId", "matchId");

-- CreateIndex
CREATE INDEX "ChallengeEvaluation_matchId_idx" ON "ChallengeEvaluation"("matchId");

-- CreateIndex
CREATE INDEX "ChallengeEvaluation_status_createdAt_idx" ON "ChallengeEvaluation"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEvaluation_userChallengeId_matchId_key" ON "ChallengeEvaluation"("userChallengeId", "matchId");

-- CreateIndex
CREATE INDEX "SeasonScore_seasonId_points_userId_idx" ON "SeasonScore"("seasonId", "points" DESC, "userId");

-- CreateIndex
CREATE INDEX "RewardLedger_userId_createdAt_idx" ON "RewardLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardLedger_userId_seasonId_idx" ON "RewardLedger"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardLedger_userChallengeId_userId_key" ON "RewardLedger"("userChallengeId", "userId");

-- AddForeignKey
ALTER TABLE "ChallengeRule" ADD CONSTRAINT "ChallengeRule_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChallenge" ADD CONSTRAINT "UserChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChallenge" ADD CONSTRAINT "UserChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChallenge" ADD CONSTRAINT "UserChallenge_completedByMatchId_fkey" FOREIGN KEY ("completedByMatchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEvaluation" ADD CONSTRAINT "ChallengeEvaluation_userChallengeId_fkey" FOREIGN KEY ("userChallengeId") REFERENCES "UserChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEvaluation" ADD CONSTRAINT "ChallengeEvaluation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonScore" ADD CONSTRAINT "SeasonScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonScore" ADD CONSTRAINT "SeasonScore_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_userChallengeId_userId_fkey" FOREIGN KEY ("userChallengeId", "userId") REFERENCES "UserChallenge"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_userId_seasonId_fkey" FOREIGN KEY ("userId", "seasonId") REFERENCES "SeasonScore"("userId", "seasonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial uniqueness allows unlimited historical seasons, with one active season.
CREATE UNIQUE INDEX "Season_one_active_idx" ON "Season" ("status") WHERE "status" = 'ACTIVE';

-- Domain ranges and the admin-authored rule DSL are validated by PostgreSQL too.
ALTER TABLE "User" ADD CONSTRAINT "User_accountId32_range" CHECK ("accountId32" BETWEEN 0 AND 4294967295);
ALTER TABLE "User" ADD CONSTRAINT "User_totalXp_nonnegative" CHECK ("totalXp" >= 0);
ALTER TABLE "Season" ADD CONSTRAINT "Season_dates_ordered" CHECK ("startsAt" < "endsAt");
ALTER TABLE "LevelThreshold" ADD CONSTRAINT "LevelThreshold_valid" CHECK ("level" > 0 AND "requiredTotalXp" >= 0);
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_rewards_nonnegative" CHECK ("xpReward" >= 0 AND "seasonPointsReward" >= 0);
ALTER TABLE "ChallengeRule" ADD CONSTRAINT "ChallengeRule_safe_value" CHECK (
  (("metric" = 'win' AND "operator" = 'EQ' AND "booleanValue" IS NOT NULL AND "numberValue" IS NULL))
  OR
  (("metric" <> 'win' AND "booleanValue" IS NULL AND "numberValue" IS NOT NULL AND "numberValue" >= 0
    AND ("metric" <> 'killParticipation' OR "numberValue" <= 1)
    AND ("metric" NOT IN ('kills', 'deaths', 'assists', 'lastHits', 'wardsPlaced', 'duration', 'heroId') OR "numberValue" = trunc("numberValue"))
    AND ("metric" <> 'heroId' OR ("numberValue" > 0 AND "numberValue" = trunc("numberValue")))))
);
ALTER TABLE "UserChallenge" ADD CONSTRAINT "UserChallenge_attempts_nonnegative" CHECK ("attemptsChecked" >= 0);
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_nonnegative" CHECK (
  "kills" >= 0 AND "deaths" >= 0 AND "assists" >= 0 AND "lastHits" >= 0
  AND "heroDamage" >= 0 AND "towerDamage" >= 0 AND "wardsPlaced" >= 0
  AND "heroId" > 0 AND ("killParticipation" IS NULL OR "killParticipation" BETWEEN 0 AND 1)
);
ALTER TABLE "Match" ADD CONSTRAINT "Match_duration_positive" CHECK ("duration" > 0);
ALTER TABLE "SeasonScore" ADD CONSTRAINT "SeasonScore_points_nonnegative" CHECK ("points" >= 0);
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_rewards_nonnegative" CHECK ("xp" >= 0 AND "seasonPoints" >= 0);
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_points_need_season" CHECK ("seasonPoints" = 0 OR "seasonId" IS NOT NULL);
