/**
 * Runtime Zod schemas for every API response shape.
 *
 * Why: TypeScript types are erased at runtime. If the backend sends
 * unexpected data (wrong shape, null where a number is expected, etc.)
 * TypeScript won't catch it. Zod parses + validates at runtime so bad
 * data is caught before it causes silent UI bugs or crashes.
 *
 * Usage: call `parseOrWarn(schema, data, 'label')` in API functions.
 * On mismatch we log a warning but return the data anyway so the app
 * stays usable during development / API evolution.
 */

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate `data` against `schema`. If validation fails, log a warning
 * (with the path that failed) and return `data` typed as `T` anyway.
 * This is intentionally lenient: a schema mismatch shouldn't crash the app.
 */
export function parseOrWarn<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.warn(
      `[Zod] Schema mismatch for "${label}":`,
      result.error.flatten(),
    )
    return data as T
  }
  return result.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive helpers
// ─────────────────────────────────────────────────────────────────────────────

const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullable()

// ─────────────────────────────────────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_STATUSES = [
  'created', 'uploaded',
  'relevance_pending', 'relevance_review',
  'taxonomy_building', 'taxonomy_locked',
  'categorizing', 'review', 'done',
] as const

export const ProjectSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: nullable(z.string()),
  original_filename: nullable(z.string()),
  file_columns: nullable(z.array(z.string())),
  status: z.enum(PROJECT_STATUSES),
  product_count: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string(),
})

export const ProjectListSchema = z.array(ProjectSchema)

// ─────────────────────────────────────────────────────────────────────────────
// Target Product
// ─────────────────────────────────────────────────────────────────────────────

export const TargetProductSchema = z.object({
  id: z.number().int(),
  project_id: z.number().int(),
  asin: nullable(z.string()),
  amazon_url: nullable(z.string()),
  image_url: nullable(z.string()),
  image_data: nullable(z.string()),
  description: nullable(z.string()),
  main_function: nullable(z.string()),
  exclusion_rules: nullable(z.array(z.string())),
})

// ─────────────────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────────────────

const RELEVANCE_LABELS = [
  'Exact Target',
  'Close Target',
  'Functional Alternative',
  'Related but Different',
  'Not Relevant',
] as const

export const CategoryAssignmentSchema = z.object({
  dimension_id: z.number().int(),
  dimension_name: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export const ProductSchema = z.object({
  id: z.number().int(),
  row_index: z.number().int(),
  data: z.record(z.string(), z.union([z.string(), z.null()])),

  // Relevance
  ai_relevance: nullable(z.enum(RELEVANCE_LABELS)),
  ai_relevance_confidence: nullable(z.number().min(0).max(1)),
  ai_relevance_reasoning: nullable(z.string()),
  user_relevance: nullable(z.string()),
  keep: nullable(z.boolean()),
  relevance_reviewed: z.boolean(),

  // Categorization
  ai_categories: nullable(z.array(CategoryAssignmentSchema)),
  final_categories: nullable(z.record(z.string(), z.string())),
  categorized: z.boolean(),
  final_notes: nullable(z.string()),
  manual_override: nullable(z.string()),
})

export const ProductsPageSchema = z.object({
  products: z.array(ProductSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  per_page: z.number().int().min(1),
})

// ─────────────────────────────────────────────────────────────────────────────
// Dimensions
// ─────────────────────────────────────────────────────────────────────────────

export const DimensionSchema = z.object({
  id: z.number().int(),
  project_id: z.number().int(),
  name: z.string().min(1),
  description: nullable(z.string()),
  taxonomy_values: z.array(z.string()).min(1),
  ai_suggested: z.boolean(),
  approved: z.boolean(),
  order: z.number().int(),
})

export const DimensionListSchema = z.array(DimensionSchema)

// ─────────────────────────────────────────────────────────────────────────────
// Background Jobs
// ─────────────────────────────────────────────────────────────────────────────

export const BackgroundJobSchema = z.object({
  id: z.string().uuid(),
  project_id: z.number().int(),
  job_type: z.enum(['relevance', 'categorization']),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  progress: z.number().int().min(0).max(100),
  processed: z.number().int().min(0),
  total: z.number().int().min(0),
  error: nullable(z.string()),
})

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export const RelevanceSummaryItemSchema = z.object({
  label: z.string(),
  count: z.number().int().min(0),
  kept: z.number().int().min(0),
  excluded: z.number().int().min(0),
  pending: z.number().int().min(0),
})

export const DimensionBreakdownSchema = z.object({
  dimension_name: z.string(),
  values: z.record(z.string(), z.number().int().min(0)),
})

export const DashboardDataSchema = z.object({
  total_products: z.number().int().min(0),
  kept_count: z.number().int().min(0),
  excluded_count: z.number().int().min(0),
  categorized_count: z.number().int().min(0),
  relevance_summary: z.array(RelevanceSummaryItemSchema),
  dimension_breakdowns: z.array(DimensionBreakdownSchema),
})
