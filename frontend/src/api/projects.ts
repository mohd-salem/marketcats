import api from './client'
import { Project, TargetProduct, Product, ProductsPage } from '../types'
import {
  parseOrWarn,
  ProjectSchema, ProjectListSchema,
  TargetProductSchema,
  ProductSchema, ProductsPageSchema,
} from '../schemas/api'

// ── Projects ──────────────────────────────────────────────────────────────────

export const listProjects = () =>
  api.get<Project[]>('/projects').then((r) => parseOrWarn(ProjectListSchema, r.data, 'listProjects'))

export const createProject = (name: string, description?: string) =>
  api.post<Project>('/projects', { name, description }).then((r) => r.data)

export const getProject = (id: number) =>
  api.get<Project>(`/projects/${id}`).then((r) => parseOrWarn(ProjectSchema, r.data, 'getProject'))

export const deleteProject = (id: number) =>
  api.delete(`/projects/${id}`)

export const uploadFile = (projectId: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api
    .post<Project>(`/projects/${projectId}/upload`, form)
    .then((r) => parseOrWarn(ProjectSchema, r.data, 'uploadFile'))
}

// ── Target Product ─────────────────────────────────────────────────────────────

export const getTargetProduct = (projectId: number) =>
  api
    .get<TargetProduct | null>(`/projects/${projectId}/target-product`)
    .then((r) => (r.data ? parseOrWarn(TargetProductSchema, r.data, 'getTargetProduct') : null))

export const upsertTargetProduct = (
  projectId: number,
  data: Partial<TargetProduct>,
) =>
  api
    .put<TargetProduct>(`/projects/${projectId}/target-product`, data)
    .then((r) => parseOrWarn(TargetProductSchema, r.data, 'upsertTargetProduct'))

// ── Products ──────────────────────────────────────────────────────────────────

export const getProducts = (
  projectId: number,
  params: {
    page?: number
    per_page?: number
    relevance?: string
    keep?: boolean
    dimension?: string
    value?: string
  } = {},
) =>
  api
    .get<ProductsPage>(`/projects/${projectId}/products`, { params })
    .then((r) => parseOrWarn(ProductsPageSchema, r.data, 'getProducts'))

// ── Relevance patch ───────────────────────────────────────────────────────────

export const patchRelevance = (
  projectId: number,
  productId: number,
  data: { user_relevance?: string; keep?: boolean; relevance_reviewed?: boolean },
) =>
  api
    .patch<Product>(`/projects/${projectId}/products/${productId}/relevance`, data)
    .then((r) => parseOrWarn(ProductSchema, r.data, 'patchRelevance'))

export const bulkPatchRelevance = (
  projectId: number,
  productIds: number[],
  keep: boolean,
) =>
  api
    .post<{ updated: number }>(
      `/projects/${projectId}/products/relevance/bulk`,
      { product_ids: productIds, keep },
    )
    .then((r) => r.data)

// ── Category patch ────────────────────────────────────────────────────────────

export const patchCategories = (
  projectId: number,
  productId: number,
  data: {
    final_categories?: Record<string, string>
    final_notes?: string
    manual_override?: string
    categorized?: boolean
  },
) =>
  api
    .patch<Product>(`/projects/${projectId}/products/${productId}/categories`, data)
    .then((r) => parseOrWarn(ProductSchema, r.data, 'patchCategories'))

export const bulkPatchCategories = (
  projectId: number,
  productIds: number[],
  dimensionName: string,
  value: string,
) =>
  api
    .post<{ updated: number }>(
      `/projects/${projectId}/products/categories/bulk`,
      { product_ids: productIds, dimension_name: dimensionName, value },
    )
    .then((r) => r.data)

export const approveAllCategories = (projectId: number) =>
  api
    .post<{ approved: number }>(`/projects/${projectId}/products/approve-all`)
    .then((r) => r.data)

// ── Excel Export ──────────────────────────────────────────────────────────────

export const downloadExcel = async (projectId: number, filename: string) => {
  const response = await api.get(`/projects/${projectId}/export/excel`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
