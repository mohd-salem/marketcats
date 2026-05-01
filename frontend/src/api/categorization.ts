import api from './client'
import { Dimension, DimensionDraft, BackgroundJob, DashboardData } from '../types'
import {
  parseOrWarn,
  DimensionSchema, DimensionListSchema,
  BackgroundJobSchema,
  DashboardDataSchema,
} from '../schemas/api'

// ── Relevance ─────────────────────────────────────────────────────────────────

export const runRelevance = (projectId: number) =>
  api
    .post<BackgroundJob>(`/projects/${projectId}/relevance/run`)
    .then((r) => parseOrWarn(BackgroundJobSchema, r.data, 'runRelevance'))

export const getRelevanceStatus = (projectId: number) =>
  api
    .get<BackgroundJob | null>(`/projects/${projectId}/relevance/status`)
    .then((r) => (r.data ? parseOrWarn(BackgroundJobSchema, r.data, 'getRelevanceStatus') : null))

// ── Dimensions ────────────────────────────────────────────────────────────────

export const getDimensions = (projectId: number) =>
  api.get<Dimension[]>(`/projects/${projectId}/dimensions`).then((r) => parseOrWarn(DimensionListSchema, r.data, 'getDimensions'))

export const suggestDimensions = (projectId: number, numDimensions = 5) =>
  api
    .post<Dimension[]>(`/projects/${projectId}/dimensions/suggest`, null, {
      params: { num_dimensions: numDimensions },
    })
    .then((r) => parseOrWarn(DimensionListSchema, r.data, 'suggestDimensions'))

export const addDimension = (projectId: number, dim: Omit<DimensionDraft, 'id'>) =>
  api.post<Dimension>(`/projects/${projectId}/dimensions`, dim).then((r) => parseOrWarn(DimensionSchema, r.data, 'addDimension'))

export const saveDimensions = (projectId: number, dimensions: DimensionDraft[]) =>
  api
    .put<Dimension[]>(`/projects/${projectId}/dimensions`, { dimensions })
    .then((r) => parseOrWarn(DimensionListSchema, r.data, 'saveDimensions'))

export const lockDimension = (projectId: number, dimensionId: number) =>
  api
    .post<Dimension>(`/projects/${projectId}/dimensions/${dimensionId}/lock`)
    .then((r) => parseOrWarn(DimensionSchema, r.data, 'lockDimension'))

export const unlockDimension = (projectId: number, dimensionId: number) =>
  api
    .post<Dimension>(`/projects/${projectId}/dimensions/${dimensionId}/unlock`)
    .then((r) => parseOrWarn(DimensionSchema, r.data, 'unlockDimension'))

export const deleteDimension = (projectId: number, dimensionId: number) =>
  api.delete(`/projects/${projectId}/dimensions/${dimensionId}`)

export const lockAllDimensions = (projectId: number) =>
  api
    .post<Dimension[]>(`/projects/${projectId}/dimensions/lock-all`)
    .then((r) => parseOrWarn(DimensionListSchema, r.data, 'lockAllDimensions'))

// ── Categorization ────────────────────────────────────────────────────────────

export const runCategorization = (projectId: number) =>
  api
    .post<BackgroundJob>(`/projects/${projectId}/categorization/run`)
    .then((r) => parseOrWarn(BackgroundJobSchema, r.data, 'runCategorization'))

export const getJobStatus = (projectId: number) =>
  api
    .get<BackgroundJob | null>(`/projects/${projectId}/categorization/status`)
    .then((r) => (r.data ? parseOrWarn(BackgroundJobSchema, r.data, 'getJobStatus') : null))

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashboard = (projectId: number) =>
  api
    .get<DashboardData>(`/projects/${projectId}/dashboard`)
    .then((r) => parseOrWarn(DashboardDataSchema, r.data, 'getDashboard'))

