import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, Lock, Play, RefreshCw,
} from 'lucide-react'

import {
  getProject, uploadFile, getTargetProduct, upsertTargetProduct,
  getProducts, approveAllCategories,
} from '../api/projects'
import {
  getDimensions, suggestDimensions, saveDimensions, lockAllDimensions,
  runRelevance, getRelevanceStatus,
  runCategorization, getJobStatus,
  getDashboard,
} from '../api/categorization'
import { DimensionDraft, BackgroundJob, ProjectStatus } from '../types'

import StatusBadge from '../components/StatusBadge'
import FileUpload from '../components/FileUpload'
import TargetProductForm from '../components/TargetProductForm'
import DimensionEditor from '../components/DimensionEditor'
import RelevanceReviewTable from '../components/RelevanceReviewTable'
import CategoryReviewTable from '../components/CategoryReviewTable'
import DashboardView from '../components/DashboardView'

type Tab = 'upload' | 'target' | 'relevance' | 'taxonomy' | 'results'

const TAB_ORDER: Tab[] = ['upload', 'target', 'relevance', 'taxonomy', 'results']

const TAB_LABELS: Record<Tab, string> = {
  upload:   '1. Upload',
  target:   '2. Target',
  relevance:'3. Relevance',
  taxonomy: '4. Taxonomy',
  results:  '5. Results',
}

/** Minimum project status needed to access each tab */
const TAB_UNLOCK: Record<Tab, ProjectStatus[]> = {
  upload:    ['created', 'uploaded', 'relevance_pending', 'relevance_review', 'taxonomy_building', 'taxonomy_locked', 'categorizing', 'review', 'done'],
  target:    ['uploaded', 'relevance_pending', 'relevance_review', 'taxonomy_building', 'taxonomy_locked', 'categorizing', 'review', 'done'],
  relevance: ['uploaded', 'relevance_pending', 'relevance_review', 'taxonomy_building', 'taxonomy_locked', 'categorizing', 'review', 'done'],
  taxonomy:  ['relevance_review', 'taxonomy_building', 'taxonomy_locked', 'categorizing', 'review', 'done'],
  results:   ['review', 'done'],
}

function isTabUnlocked(tab: Tab, status: ProjectStatus): boolean {
  return TAB_UNLOCK[tab].includes(status)
}

function JobProgressBar({ job }: { job: BackgroundJob }) {
  if (job.status === 'failed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Job failed: {job.error ?? 'Unknown error'}
      </div>
    )
  }
  if (job.status === 'completed') return null
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <Loader2 size={14} className="animate-spin" />
        <span>
          {job.job_type === 'relevance' ? 'Classifying relevance' : 'Categorizing products'} &mdash;{' '}
          {job.processed}/{job.total} ({job.progress}%)
        </span>
      </div>
      <div className="mt-2 rounded-full bg-blue-100">
        <div
          className="h-1.5 rounded-full bg-blue-500 transition-all"
          style={{ width: `${job.progress}%` }}
        />
      </div>
    </div>
  )
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('upload')

  // â”€â”€ Queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'relevance_pending' || s === 'categorizing' ? 3000 : false
    },
  })

  const { data: targetProduct } = useQuery({
    queryKey: ['target-product', projectId],
    queryFn: () => getTargetProduct(projectId),
    enabled: !!project,
  })

  const { data: dimensions = [] } = useQuery({
    queryKey: ['dimensions', projectId],
    queryFn: () => getDimensions(projectId),
    enabled: !!project,
  })

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', projectId, tab],
    queryFn: () => getProducts(projectId, { per_page: 200 }),
    enabled: !!project && project.status !== 'created',
    refetchInterval: tab === 'relevance' && project?.status === 'relevance_pending' ? 5000 : false,
  })

  const { data: relevanceJob } = useQuery({
    queryKey: ['relevance-job', projectId],
    queryFn: () => getRelevanceStatus(projectId),
    enabled: !!project && ['relevance_pending', 'relevance_review'].includes(project.status ?? ''),
    refetchInterval: project?.status === 'relevance_pending' ? 3000 : false,
  })

  const { data: catJob } = useQuery({
    queryKey: ['cat-job', projectId],
    queryFn: () => getJobStatus(projectId),
    enabled: !!project && ['categorizing', 'review', 'done'].includes(project.status ?? ''),
    refetchInterval: project?.status === 'categorizing' ? 3000 : false,
  })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => getDashboard(projectId),
    enabled: tab === 'results' && !!project,
    refetchInterval: tab === 'results' ? 10000 : false,
  })

  // Auto-advance tab based on project status
  useEffect(() => {
    if (!project) return
    const status = project.status
    if (status === 'created') setTab('upload')
    else if (status === 'uploaded' && tab === 'upload') setTab('target')
    else if (status === 'relevance_review' && tab === 'relevance') {
      // stay — user needs to review
    } else if (status === 'taxonomy_building' && tab === 'relevance') setTab('taxonomy')
    else if (status === 'review' && tab === 'taxonomy') setTab('results')
  }, [project?.status])

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadFile(projectId, file),
    onSuccess: (updated) => {
      qc.setQueryData(['project', projectId], updated)
      toast.success(`Loaded ${updated.product_count} products`)
      setTab('target')
    },
    onError: () => toast.error('Upload failed'),
  })

  const targetMut = useMutation({
    mutationFn: (data: Parameters<typeof upsertTargetProduct>[1]) =>
      upsertTargetProduct(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target-product', projectId] })
      toast.success('Target product saved')
    },
    onError: () => toast.error('Failed to save target product'),
  })

  const relevanceMut = useMutation({
    mutationFn: () => runRelevance(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['relevance-job', projectId] })
      toast.success('Relevance classification started')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to start job'),
  })

  const suggestMut = useMutation({
    mutationFn: () => suggestDimensions(projectId, 5),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dimensions', projectId] })
      toast.success('AI suggested dimensions — review and lock before proceeding')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'AI suggestion failed'),
  })

  const saveDimsMut = useMutation({
    mutationFn: (drafts: DimensionDraft[]) => saveDimensions(projectId, drafts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dimensions', projectId] })
      toast.success('Dimensions saved')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Save failed'),
  })

  const lockAllMut = useMutation({
    mutationFn: () => lockAllDimensions(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dimensions', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('All dimensions locked')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Lock failed'),
  })

  const catMut = useMutation({
    mutationFn: () => runCategorization(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['cat-job', projectId] })
      toast.success('Categorization started')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to start job'),
  })

  const approveAllMut = useMutation({
    mutationFn: () => approveAllCategories(projectId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['products', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['dashboard', projectId] })
      toast.success(`Approved ${data.approved} products`)
    },
    onError: () => toast.error('Approve all failed'),
  })

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loadingProject) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (!project) return <div className="p-8 text-red-500">Project not found</div>

  const products = productsData?.products ?? []
  const lockedDimensions = dimensions.filter((d) => d.approved)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-gray-500">{project.description}</p>
          )}
        </div>
        <div className="ml-auto">
          <StatusBadge status={project.status} />
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {TAB_ORDER.map((t) => {
          const unlocked = isTabUnlocked(t, project.status)
          return (
            <button
              key={t}
              disabled={!unlocked}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition ${
                tab === t
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : unlocked
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'cursor-not-allowed text-gray-300'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="card">

        {/* â”€â”€ Step 1: Upload â”€â”€ */}
        {tab === 'upload' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Upload Helium 10 export</h2>
            {project.original_filename && (
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Current file: <strong>{project.original_filename}</strong> ({project.product_count} products)
              </div>
            )}
            <FileUpload
              onUpload={(file) => uploadMut.mutate(file)}
              uploading={uploadMut.isPending}
            />
            {project.status !== 'created' && (
              <div className="flex justify-end pt-2">
                <button className="btn-primary" onClick={() => setTab('target')}>
                  Next: Define Target Product &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Target product */}
        {tab === 'target' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Define target product / niche</h2>
            <p className="text-sm text-gray-500">
              This context guides the AI in classifying relevance and building a useful taxonomy.
            </p>
            <TargetProductForm
              initial={targetProduct ?? undefined}
              onSave={(data) => targetMut.mutate(data)}
              saving={targetMut.isPending}
            />
            {targetProduct && (
              <div className="flex justify-end">
                <button
                  className="btn-primary"
                  onClick={() => setTab('relevance')}
                >
                  Next: Classify Relevance →
                </button>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Step 3: Relevance â”€â”€ */}
        {tab === 'relevance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Relevance classification</h2>

              <div className="flex items-center gap-3">
                {project.status === 'relevance_review' && (
                  <button
                    className="flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    onClick={() => relevanceMut.mutate()}
                    disabled={relevanceMut.isPending}
                    title="Re-run AI classification"
                  >
                    <RefreshCw size={13} />
                    Re-classify
                  </button>
                )}

                {(project.status === 'uploaded' || project.status === 'relevance_review' || project.status === 'relevance_pending') && (
                  <button
                    className="btn-primary flex items-center gap-1.5"
                    onClick={() => relevanceMut.mutate()}
                    disabled={
                      relevanceMut.isPending ||
                      project.status === 'relevance_pending' ||
                      !targetProduct
                    }
                  >
                    <Play size={14} />
                    {project.status === 'relevance_pending' ? 'Classifying…' : 'Run AI classification'}
                  </button>
                )}
              </div>
            </div>

            {!targetProduct && (
              <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Set a target product first (Step 2) before running classification.
              </div>
            )}

            {relevanceJob && relevanceJob.status !== 'completed' && (
              <JobProgressBar job={relevanceJob} />
            )}

            {project.status === 'relevance_review' && (
              <>
                <p className="text-sm text-gray-500">
                  Review AI labels below. Mark each product as <strong>Keep</strong> or{' '}
                  <strong>Exclude</strong>. Only kept products move to taxonomy and categorization.
                </p>
                <RelevanceReviewTable
                  projectId={projectId}
                  products={products}
                  isLoading={loadingProducts}
                />
                <div className="flex justify-end border-t border-gray-100 pt-4">
                  <button
                    className="btn-primary"
                    onClick={() => setTab('taxonomy')}
                    disabled={products.filter((p) => p.keep === null).length > 0}
                    title={
                      products.filter((p) => p.keep === null).length > 0
                        ? 'Review all products before proceeding'
                        : ''
                    }
                  >
                    Next: Build Taxonomy →
                  </button>
                </div>
              </>
            )}

            {project.status === 'uploaded' && !relevanceJob && (
              <p className="text-sm text-gray-400">
                Click "Run AI classification" to start. AI will label each product with a
                relevance score. You will review and approve the results before moving on.
              </p>
            )}
          </div>
        )}

        {/* â”€â”€ Step 4: Taxonomy â”€â”€ */}
        {tab === 'taxonomy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Build & lock taxonomy</h2>
              <button
                className="flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => suggestMut.mutate()}
                disabled={suggestMut.isPending}
              >
                {suggestMut.isPending ? (
                  <><Loader2 size={13} className="animate-spin" /> Asking AI…</>
                ) : (
                  <>AI suggest dimensions</>
                )}
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Define 3–7 dimensions with controlled value lists. Lock each dimension before running
              categorization — the AI will only assign values from locked lists.
            </p>

            <DimensionEditor
              projectId={projectId}
              dimensions={dimensions}
              onSave={(drafts) => saveDimsMut.mutate(drafts)}
              onLockAll={() => lockAllMut.mutate()}
              saving={saveDimsMut.isPending}
              lockingAll={lockAllMut.isPending}
            />

            {lockedDimensions.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-sm text-gray-500">
                  {lockedDimensions.length} dimension{lockedDimensions.length !== 1 ? 's' : ''} locked
                </span>
                <button
                  className="btn-primary flex items-center gap-1.5"
                  onClick={() => catMut.mutate()}
                  disabled={catMut.isPending || project.status === 'categorizing'}
                >
                  <Play size={14} />
                  {project.status === 'categorizing' ? 'Categorizing…' : 'Run categorization'}
                </button>
              </div>
            )}

            {catJob && catJob.status !== 'completed' && <JobProgressBar job={catJob} />}
          </div>
        )}

        {/* ── Step 5: Results ── */}
        {tab === 'results' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Review &amp; approve</h2>
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => catMut.mutate()}
                  disabled={catMut.isPending || project.status === 'categorizing'}
                  title="Re-run AI categorization"
                >
                  <RefreshCw size={13} />
                  Re-categorize
                </button>
                <button
                  className="btn-primary flex items-center gap-1.5"
                  onClick={() => approveAllMut.mutate()}
                  disabled={approveAllMut.isPending}
                >
                  Approve all &amp; finish
                </button>
              </div>
            </div>

            {catJob && catJob.status !== 'completed' && <JobProgressBar job={catJob} />}

            <CategoryReviewTable
              projectId={projectId}
              products={products}
              dimensions={lockedDimensions}
              isLoading={loadingProducts}
            />

            {project.status === 'done' && dashboard && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="mb-4 text-base font-semibold text-gray-800">Dashboard</h3>
                <DashboardView
                  projectId={projectId}
                  originalFilename={project.original_filename}
                  data={dashboard}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
