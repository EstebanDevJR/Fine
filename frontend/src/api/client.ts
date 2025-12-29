import { getAccessToken } from './supabaseClient'
import type { z } from 'zod'
import {
  AnalysisSchema,
  DatasetSchema,
  FullAuditStatusSchema,
  HealthSchema,
  MetricsSchema,
  ModelSchema,
  ReadySchema,
} from './schemas'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function withAuthHeaders(extra?: HeadersInit) {
  const token = await getAccessToken()
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  return {
    ...(extra || {}),
    ...auth,
  } as HeadersInit
}

async function readErrorPayload(res: Response): Promise<{ message: string; payload: unknown }> {
  const contentType = res.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const payload = await res.json()
      const detail =
        payload && typeof payload === 'object' && payload !== null && 'detail' in payload
          ? (payload as { detail?: unknown }).detail
          : undefined
      const msg = (typeof detail === 'string' ? detail : JSON.stringify(payload)) || res.statusText
      return { message: msg, payload }
    }
    const text = await res.text()
    return { message: text || res.statusText, payload: text }
  } catch {
    return { message: res.statusText, payload: null }
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await withAuthHeaders(options.headers)
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const { message, payload } = await readErrorPayload(res)
    throw new ApiError(message, res.status, payload)
  }
  // Gracefully handle no-content responses
  if (res.status === 204 || res.status === 205) {
    // @ts-expect-error: allow void return for no-content responses
    return undefined
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  // @ts-expect-error: allow non-JSON responses
  return res.text()
}

async function requestZod<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  options: RequestInit = {},
): Promise<z.infer<TSchema>> {
  const data = await request<unknown>(path, options)
  return schema.parse(data)
}

async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const headers = await withAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form, headers })
  if (!res.ok) {
    const { message, payload } = await readErrorPayload(res)
    throw new ApiError(message, res.status, payload)
  }
  return res.json()
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const headers = await withAuthHeaders(options.headers)
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const { message, payload } = await readErrorPayload(res)
    throw new ApiError(message, res.status, payload)
  }
  return res.blob()
}

export const api = {
  listDatasets: () => requestZod('/datasets', DatasetSchema.array()),
  listModels: () => requestZod('/models', ModelSchema.array()),
  presignDataset: (form: FormData) => requestForm('/upload/presign/dataset', form),
  confirmDataset: (form: FormData) => requestForm('/upload/dataset/confirm', form),
  presignModel: (form: FormData) => requestForm('/upload/presign/model', form),
  confirmModel: (form: FormData) => requestForm('/upload/model/confirm', form),
  uploadDatasetDirect: (form: FormData) => requestForm('/upload/dataset', form),
  uploadModelDirect: (form: FormData) => requestForm('/upload/model', form),
  deleteDataset: (id: number) => request(`/datasets/${id}`, { method: 'DELETE' }),
  deleteModel: (id: number) => request(`/models/${id}`, { method: 'DELETE' }),
  auditRun: (body: unknown) =>
    request('/audit/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditXai: (body: unknown) =>
    request('/audit/xai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditSensitivity: (body: unknown) =>
    request('/audit/sensitivity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditRobustness: (body: unknown) =>
    request('/audit/robustness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditFairness: (body: unknown) =>
    request('/audit/fairness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditDiagnose: (body: unknown) =>
    request('/audit/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditFullStart: (body: unknown) =>
    request('/audit/full', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  auditFullStatus: (jobId: string) => requestZod(`/audit/full/${jobId}`, FullAuditStatusSchema),
  auditGraph: (body: unknown) =>
    request('/audit/graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  listAnalyses: () => requestZod('/audit/analyses', AnalysisSchema.array()),
  getAnalysis: (id: number) => requestZod(`/audit/analyses/${id}`, AnalysisSchema),
  deleteAnalysis: (id: number) => request(`/audit/analyses/${id}`, { method: 'DELETE' }),
  analysisQA: (body: unknown) =>
    request('/audit/qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  reportGenerate: (body: unknown) =>
    request('/report/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  status: () => requestZod('/health', HealthSchema),
  ready: () => requestZod('/ready', ReadySchema),
  metrics: () => requestZod('/metrics', MetricsSchema),
  deleteAccount: () => request('/account', { method: 'DELETE' }),
  downloadAnalysisReportTxt: (analysisId: number) => requestBlob(`/report/analysis/${analysisId}/download`),
}

