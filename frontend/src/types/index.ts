// ── Project ────────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'created'
  | 'uploaded'
  | 'relevance_pending'
  | 'relevance_review'
  | 'taxonomy_building'
  | 'taxonomy_locked'
  | 'categorizing'
  | 'review'
  | 'done'

export interface Project {
  id: number
  name: string
  description: string | null
  original_filename: string | null
  file_columns: string[] | null
  status: ProjectStatus
  product_count: number
  created_at: string
  updated_at: string
}

// ── Target Product ─────────────────────────────────────────────────────────────

export interface TargetProduct {
  id: number
  project_id: number
  asin?: string | null
  amazon_url?: string | null
  image_url?: string | null
  image_data?: string | null
  description?: string | null
  main_function?: string | null
  exclusion_rules?: string[] | null
}

// ── Products ───────────────────────────────────────────────────────────────────

export const RELEVANCE_LABELS = [
  'Exact Target',
  'Close Target',
  'Functional Alternative',
  'Related but Different',
  'Not Relevant',
] as const

export type RelevanceLabel = typeof RELEVANCE_LABELS[number]

export interface CategoryAssignment {
  dimension_id: number
  dimension_name: string
  value: string
  confidence: number
  reasoning: string
}

export interface Product {
  id: number
  row_index: number
  data: Record<string, string | null>
  ai_relevance: RelevanceLabel | null
  ai_relevance_confidence: number | null
  ai_relevance_reasoning: string | null
  user_relevance: string | null
  keep: boolean | null
  relevance_reviewed: boolean
  ai_categories: CategoryAssignment[] | null
  final_categories: Record<string, string> | null
  categorized: boolean
  final_notes: string | null
  manual_override: string | null
}

export interface ProductsPage {
  products: Product[]
  total: number
  page: number
  per_page: number
}

// ── Dimensions ─────────────────────────────────────────────────────────────────

export interface Dimension {
  id: number
  project_id: number
  name: string
  description: string
  taxonomy_values: string[]
  approved: boolean
  order: number
}

export interface DimensionDraft {
  id?: number
  name: string
  description: string
  taxonomy_values: string[]
  approved: boolean
  order: number
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'
export type JobType = 'relevance' | 'categorization'

export interface BackgroundJob {
  id: string
  project_id: number
  job_type: JobType
  status: JobStatus
  progress: number
  processed: number
  total: number
  error: string | null
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface RelevanceSummary {
  label: string
  count: number
  kept: number
  excluded: number
  pending: number
}

export interface DimensionBreakdown {
  dimension_name: string
  values: Record<string, number>
}

export interface DashboardData {
  total_products: number
  relevance_summary: RelevanceSummary[]
  kept_count: number
  excluded_count: number
  pending_count: number
  categorized_count: number
  dimension_breakdowns: DimensionBreakdown[]
}