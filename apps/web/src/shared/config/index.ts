import { API_PREFIX } from '@aegis-trials/shared'

// This value is public and must never contain a credential.
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || API_PREFIX).replace(/\/$/, '')
