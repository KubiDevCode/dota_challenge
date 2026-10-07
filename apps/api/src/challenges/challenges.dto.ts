import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { ChallengeDifficulty, ChallengeMode, ChallengePeriod } from '../database/generated/enums'

export class ListChallengesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20

  @IsOptional()
  @IsEnum(ChallengeDifficulty)
  difficulty?: ChallengeDifficulty

  @IsOptional()
  @IsEnum(ChallengeMode)
  mode?: ChallengeMode

  @IsOptional()
  @IsEnum(ChallengePeriod)
  period?: ChallengePeriod

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string
}

// Activate accepts no client state, including no client-chosen activation timestamp.
export class ActivateChallengeBodyDto {}
