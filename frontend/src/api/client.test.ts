import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiError } from './client'

// Mock supabase token getter to avoid env dependency in tests
vi.mock('./supabaseClient', () => ({
  getAccessToken: async () => null,
}))

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws ApiError with JSON detail when backend returns JSON error', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const { api } = await import('./client')

    await expect(api.status()).rejects.toBeInstanceOf(ApiError)
    await expect(api.status()).rejects.toMatchObject({ status: 403 })
    await expect(api.status()).rejects.toThrow('Forbidden')
  })
})


