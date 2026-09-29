import { Type } from 'class-transformer'
import { Allow, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator'
import { ChallengeDifficulty, ChallengeMode, PublicationStatus, RuleMetric, RuleOperator, SeasonStatus } from '../database/generated/enums'

const INT_MAX = 2147483647

export class AdminRuleDto {
  @IsEnum(RuleMetric)
  metric!: RuleMetric

  @IsEnum(RuleOperator)
  operator!: RuleOperator

  // The shared Rule Engine validates the type and range against the metric.
  @Allow()
  value!: unknown
}

export class CreateChallengeDto {
  @IsString() @Matches(/\S/) @MaxLength(200)
  title!: string

  @IsString()
  description!: string

  @IsString() @Matches(/\S/) @MaxLength(64)
  category!: string

  @IsEnum(ChallengeDifficulty)
  difficulty!: ChallengeDifficulty

  @IsEnum(ChallengeMode)
  mode!: ChallengeMode

  @IsInt() @Min(0) @Max(INT_MAX)
  xpReward!: number

  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(INT_MAX)
  seasonPointsReward?: number

  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayUnique() @IsIn([1, 22], { each: true })
  allowedMatchModes?: number[]

  @ValidateIf((_object, value) => value !== undefined) @IsEnum(PublicationStatus)
  publicationStatus?: PublicationStatus

  @IsOptional() @IsISO8601({ strict: true })
  availableFrom?: string | null

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AdminRuleDto)
  rules!: AdminRuleDto[]
}

export class PatchChallengeDto {
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/\S/) @MaxLength(200)
  title?: string

  @ValidateIf((_object, value) => value !== undefined) @IsString()
  description?: string

  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/\S/) @MaxLength(64)
  category?: string

  @ValidateIf((_object, value) => value !== undefined) @IsEnum(ChallengeDifficulty)
  difficulty?: ChallengeDifficulty

  @ValidateIf((_object, value) => value !== undefined) @IsEnum(ChallengeMode)
  mode?: ChallengeMode

  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(INT_MAX)
  xpReward?: number

  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(INT_MAX)
  seasonPointsReward?: number

  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayUnique() @IsIn([1, 22], { each: true })
  allowedMatchModes?: number[]

  @ValidateIf((_object, value) => value !== undefined) @IsEnum(PublicationStatus)
  publicationStatus?: PublicationStatus

  @IsOptional() @IsISO8601({ strict: true })
  availableFrom?: string | null

  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AdminRuleDto)
  rules?: AdminRuleDto[]
}

export class LevelThresholdDto {
  @IsInt() @Min(1) @Max(INT_MAX)
  level!: number

  @IsInt() @Min(0) @Max(INT_MAX)
  requiredTotalXp!: number

  @IsString() @Matches(/\S/) @MaxLength(128)
  rankName!: string
}

export class ReplaceLevelThresholdsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LevelThresholdDto)
  thresholds!: LevelThresholdDto[]
}

export class CreateSeasonDto {
  @IsString() @Matches(/\S/) @MaxLength(128)
  name!: string

  @IsISO8601({ strict: true })
  startsAt!: string

  @IsISO8601({ strict: true })
  endsAt!: string

  @ValidateIf((_object, value) => value !== undefined) @IsEnum(SeasonStatus)
  status?: SeasonStatus
}

export class PatchSeasonDto {
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/\S/) @MaxLength(128)
  name?: string

  @ValidateIf((_object, value) => value !== undefined) @IsISO8601({ strict: true })
  startsAt?: string

  @ValidateIf((_object, value) => value !== undefined) @IsISO8601({ strict: true })
  endsAt?: string

  @ValidateIf((_object, value) => value !== undefined) @IsEnum(SeasonStatus)
  status?: SeasonStatus
}
