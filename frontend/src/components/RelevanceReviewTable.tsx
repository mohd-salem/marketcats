import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Product, RELEVANCE_LABELS, RelevanceLabel } from '../types'
import { patchRelevance, bulkPatchRelevance } from '../api/projects'

const LABEL_COLORS: Record<RelevanceLabel, string> = {
  'Exact Target':           'bg-green-100 text-green-800',
  'Close Target':           'bg-lime-100 text-lime-800',
  'Functional Alternative': 'bg-yellow-100 text-yellow-800',
  'Related but Different':  'bg-orange-100 text-orange-800',
  'Not Relevant':           'bg-red-100 text-red-800',
}

const KEEP_COLORS = {
  true:  'bg-green-100 text-green-700 border-green-300',
  false: 'bg-red-100 text-red-700 border-red-300',
  null:  'bg-gray-100 text-gray-500 border-gray-200',
}

interface Props {
  projectId: number
  products: Product[]
  isLoading: boolean
}

const TITLE_KEYS = ['Title', 'title', 'Product Title', 'Name', 'name', 'ASIN', 'asin']
const getTitle = (data: Record<string, string | null>): string => {
  for (const k of TITLE_KEYS) {
    if (data[k]) return data[k] as string
  }
  const first = Object.values(data).find((v) => v)
  return first ?? '—'
}

export default function RelevanceReviewTable({ projectId, products, isLoading }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filterLabel, setFilterLabel] = useState<string>('all')
  const [filterKeep, setFilterKeep] = useState<string>('all')
  const [expandedReasoning, setExpandedReasoning] = useState<number | null>(null)

  const patchMut = useMutation({
    mutationFn: ({
      productId,
      data,
    }: {
      productId: number
      data: { keep?: boolean; relevance_reviewed?: boolean }
    }) => patchRelevance(projectId, productId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', projectId] }),
    onError: () => toast.error('Failed to update product'),
  })

  const bulkMut = useMutation({
    mutationFn: ({ ids, keep }: { ids: number[]; keep: boolean }) =>
      bulkPatchRelevance(projectId, ids, keep),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['products', projectId] })
      toast.success(`Updated ${data.updated} products`)
      setSelected(new Set())
    },
    onError: () => toast.error('Bulk update failed'),
  })

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filterLabel !== 'all' && p.ai_relevance !== filterLabel) return false
      if (filterKeep === 'keep' && p.keep !== true) return false
      if (filterKeep === 'exclude' && p.keep !== false) return false
      if (filterKeep === 'pending' && p.keep !== null) return false
      return true
    })
  }, [products, filterLabel, filterKeep])

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((p) => p.id)))
    }
  }

  const pending = products.filter((p) => p.keep === null).length
  const kept = products.filter((p) => p.keep === true).length
  const excluded = products.filter((p) => p.keep === false).length

  if (isLoading) {
    return <div className="py-12 text-center text-gray-400">Loading products…</div>
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <span className="text-gray-600">{products.length} total</span>
        <span className="text-green-700">✓ {kept} kept</span>
        <span className="text-red-600">✕ {excluded} excluded</span>
        <span className="text-gray-400">? {pending} pending</span>
      </div>

      {/* Filters + bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input text-sm py-1"
          value={filterLabel}
          onChange={(e) => setFilterLabel(e.target.value)}
        >
          <option value="all">All labels</option>
          {RELEVANCE_LABELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          className="input text-sm py-1"
          value={filterKeep}
          onChange={(e) => setFilterKeep(e.target.value)}
        >
          <option value="all">All decisions</option>
          <option value="keep">Keep only</option>
          <option value="exclude">Exclude only</option>
          <option value="pending">Pending only</option>
        </select>

        {selected.size > 0 && (
          <>
            <span className="text-sm text-gray-500">{selected.size} selected</span>
            <button
              className="btn-primary py-1 text-sm"
              onClick={() => bulkMut.mutate({ ids: [...selected], keep: true })}
              disabled={bulkMut.isPending}
            >
              Keep selected
            </button>
            <button
              className="rounded border border-red-300 bg-red-50 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
              onClick={() => bulkMut.mutate({ ids: [...selected], keep: false })}
              disabled={bulkMut.isPending}
            >
              Exclude selected
            </button>
          </>
        )}

        <span className="ml-auto text-sm text-gray-400">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">AI Label</th>
              <th className="w-20 px-3 py-2 text-center font-medium text-gray-600">Conf.</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Reasoning</th>
              <th className="w-32 px-3 py-2 text-center font-medium text-gray-600">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => {
              const labelCls =
                LABEL_COLORS[(p.ai_relevance as RelevanceLabel) ?? 'Not Relevant'] ??
                'bg-gray-100 text-gray-700'
              const keepStr = p.keep === true ? 'true' : p.keep === false ? 'false' : 'null'
              const keepCls = KEEP_COLORS[keepStr as keyof typeof KEEP_COLORS]
              const showReasoning = expandedReasoning === p.id

              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
                  <td className="max-w-xs px-3 py-2">
                    <div className="truncate font-medium text-gray-900" title={getTitle(p.data)}>
                      {getTitle(p.data)}
                    </div>
                    {p.data['ASIN'] && (
                      <div className="text-xs text-gray-400">{p.data['ASIN']}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.ai_relevance ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${labelCls}`}>
                        {p.ai_relevance}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500">
                    {p.ai_relevance_confidence != null
                      ? `${Math.round(p.ai_relevance_confidence * 100)}%`
                      : '—'}
                  </td>
                  <td className="max-w-sm px-3 py-2 text-gray-500">
                    {p.ai_relevance_reasoning ? (
                      <div>
                        <span
                          className={showReasoning ? '' : 'line-clamp-1'}
                        >
                          {p.ai_relevance_reasoning}
                        </span>
                        {p.ai_relevance_reasoning.length > 80 && (
                          <button
                            className="ml-1 text-xs text-blue-500 hover:underline"
                            onClick={() =>
                              setExpandedReasoning(showReasoning ? null : p.id)
                            }
                          >
                            {showReasoning ? 'less' : 'more'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        title="Keep"
                        className={`rounded border px-2 py-0.5 text-xs font-medium transition ${
                          p.keep === true
                            ? 'border-green-400 bg-green-100 text-green-700'
                            : 'border-gray-200 text-gray-400 hover:bg-green-50'
                        }`}
                        onClick={() =>
                          patchMut.mutate({
                            productId: p.id,
                            data: { keep: true, relevance_reviewed: true },
                          })
                        }
                      >
                        Keep
                      </button>
                      <button
                        title="Exclude"
                        className={`rounded border px-2 py-0.5 text-xs font-medium transition ${
                          p.keep === false
                            ? 'border-red-400 bg-red-100 text-red-700'
                            : 'border-gray-200 text-gray-400 hover:bg-red-50'
                        }`}
                        onClick={() =>
                          patchMut.mutate({
                            productId: p.id,
                            data: { keep: false, relevance_reviewed: true },
                          })
                        }
                      >
                        Exclude
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-gray-400">No products match the current filter.</div>
        )}
      </div>
    </div>
  )
}
