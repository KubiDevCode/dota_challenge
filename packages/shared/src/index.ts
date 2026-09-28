// Browser-safe, framework-independent public API.
export * from './rule-engine'

export const APP_NAME = 'Aegis Trials'
export const API_PREFIX = '/api'

export interface HealthResponse {
  status: 'ok'
  service: 'api'
}
