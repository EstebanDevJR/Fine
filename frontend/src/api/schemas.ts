import { z } from 'zod'

export const HealthSchema = z.object({
  status: z.string(),
  app: z.string(),
  env: z.string(),
})
export type Health = z.infer<typeof HealthSchema>

export const ReadySchema = z.object({
  status: z.string(),
})
export type Ready = z.infer<typeof ReadySchema>

export const MetricsSchema = z.object({
  counters: z.record(z.number().int()),
  timings_ms: z.record(z.number()),
})
export type Metrics = z.infer<typeof MetricsSchema>

export const DatasetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  filename: z.string(),
  path: z.string(),
  s3_uri: z.string().nullable().optional(),
  file_format: z.string(),
  size_bytes: z.number().int(),
  target_column: z.string(),
  checksum: z.string(),
  created_at: z.string(),
})
export type Dataset = z.infer<typeof DatasetSchema>

export const ModelSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  framework: z.string(),
  task_type: z.string().nullable().optional(),
  filename: z.string(),
  path: z.string(),
  s3_uri: z.string().nullable().optional(),
  size_bytes: z.number().int(),
  checksum: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.string(),
})
export type Model = z.infer<typeof ModelSchema>

export const AnalysisSchema = z.object({
  id: z.number().int(),
  status: z.string(),
  dataset_id: z.number().int(),
  model_id: z.number().int(),
  report_path: z.string().nullable().optional(),
  pdf_path: z.string().nullable().optional(),
  result: z.record(z.any()).nullable().optional(),
  created_at: z.string(),
})
export type Analysis = z.infer<typeof AnalysisSchema>

export const FullAuditStatusSchema = z.object({
  job_id: z.string(),
  state: z.string(),
  progress: z.number().nullable().optional(),
  step: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  result: z.any().nullable().optional(),
  analysis_id: z.number().int().nullable().optional(),
})
export type FullAuditStatus = z.infer<typeof FullAuditStatusSchema>


