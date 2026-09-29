DROP INDEX "SeasonScore_seasonId_points_userId_idx";
CREATE INDEX "SeasonScore_seasonId_points_createdAt_userId_idx"
  ON "SeasonScore"("seasonId", "points" DESC, "createdAt", "userId");
CREATE INDEX "Match_startedAt_id_idx" ON "Match"("startedAt" DESC, "id" DESC);
