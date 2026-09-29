import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

/** Bounded offset pagination for public rankings and private match history. */
export class PageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20
}
