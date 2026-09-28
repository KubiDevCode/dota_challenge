import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'
import type { HealthResponse } from '@aegis-trials/shared'

class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok'

  @ApiProperty({ enum: ['api'], example: 'api' })
  service!: 'api'
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponseDto, description: 'API process is running (liveness only).' })
  getHealth(): HealthResponse {
    return { status: 'ok', service: 'api' }
  }
}
