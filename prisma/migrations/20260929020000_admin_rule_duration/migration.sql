-- The shared Rule Engine permits fractional match duration in seconds.
ALTER TABLE "ChallengeRule" DROP CONSTRAINT "ChallengeRule_safe_value";
ALTER TABLE "ChallengeRule" ADD CONSTRAINT "ChallengeRule_safe_value" CHECK (
  ("metric" = 'win' AND "operator" = 'EQ' AND "booleanValue" IS NOT NULL AND "numberValue" IS NULL)
  OR
  ("metric" <> 'win' AND "booleanValue" IS NULL AND "numberValue" IS NOT NULL AND "numberValue" >= 0
    AND ("metric" <> 'killParticipation' OR "numberValue" <= 1)
    AND ("metric" NOT IN ('kills', 'deaths', 'assists', 'lastHits', 'wardsPlaced', 'heroId') OR "numberValue" = trunc("numberValue"))
    AND ("metric" <> 'heroId' OR "numberValue" > 0))
);
