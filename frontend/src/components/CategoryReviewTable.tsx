import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Product, Dimension } from '../types'
import { patchCategories, bulkPatchCategories } from '../api/projects'

interface Props {
  projectId: number
  products: Product[]
  dimensions: Dimension[]
  isLoading: boolean
}

const TITLE_KEYS = ['Title', 'title', 'Product Title', 'Name', 'name', 'ASIN', 'asin']
const getTitle = (data: Record<string, string | null>): string => {
  for (const k of TITLE_KEYS) {
    if (data[k]) return data[k] as string
  }
  return Object.values(data).find((v) => v) ?? '—'
}

export default function CategoryReviewTable({
  projectId,
  products,
  dimensions,
  isLoading,
}: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filterDim, setFilterDim] = useState<string>('all')
  const [filterVal, setFilterVal] = useState<string>('all')
  const [editCell, setEditCell] = useState<{ productId: number; dimName: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [bulkDim, setBulkDim] = useState<string>(dimensions[0]?.name ?? '')
  const [bulkVal, setBulkVal] = useState<string>('')

  const patchMut = useMutation({
    mutationFn: ({
      productId,
      data,
    }: {
      productId: number
      data: { final_categories?: Record<string, string>; final_notes?: string; categorized?: boolean }
    }) => patchCategories(projectId, productId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', projectId] }),
    onError: () => toast.error('Save failed'),
  })

  const bulkMut = useMutation({
    mutationFn: ({ ids, dim, val }: { ids: number[]; dim: string; val: string }) =>
      bulkPatchCategories(projectId, ids, dim, val),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['products', projectId] })
      toast.success(`Updated ${data.updated} products`)
      setSelected(new Set())
    },
    onError: () => toast.error('Bulk update failed'),
  })

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!p.keep) return false
      if (filterDim !== 'all' && filterVal !== 'all') {
        const val = p.final_categories?.[filterDim]
        if (val !== filterVal) return false
      }
      return true
    })
  }, [products, filterDim, filterVal])

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const startEdit = (productId: number, dimName: string, currentVal: string) => {
    setEditCell({ productId, dimName })
    setEditValue(currentVal)
  }

  const commitEdit = (product: Product) => {
    if (!editCell) return
    const newCats = { ...(product.final_categories ?? {}), [editCell.dimName]: editValue }
    patchMut.mutate({ productId: product.id, data: { final_categories: newCats } })
    setEditCell(null)
  }

  const availableValues = useMemo(() => {
    const dim = dimensions.find((d) => d.name === filterDim)
    return dim?.taxonomy_values ?? []
  }, [filterDim, dimensions])

  const bulkDimObj = dimensions.find((d) => d.name === bulkDim)

  if (isLoading) {
    return <div className="py-12 text-center text-gray-400">Loading products…</div>
  }

  const categorized = products.filter((p) => p.keep && p.categorized).length
  const total = products.filter((p) => p.keep).length

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-sm text-gray-600">
          {categorized} / {total} products approved
        </span>
        <div className="flex-1 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-green-500 transition-all"
            style={{ width: total > 0 ? `${(categorized / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input text-sm py-1"
          value={filterDim}
          onChange={(e) => {
            setFilterDim(e.target.value)
            setFilterVal('all')
          }}
        >
          <option value="all">All dimensions</option>
          {dimensions.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>

        {filterDim !== 'all' && (
          <select
            className="input text-sm py-1"
            value={filterVal}
            onChange={(e) => setFilterVal(e.target.value)}
          >
            <option value="all">All values</option>
            {availableValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}

        {/* Bulk assign */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-4 border-l pl-4 border-gray-200">
            <span className="text-sm text-gray-500">{selected.size} selected:</span>
            <select
              className="input text-sm py-1"
              value={bulkDim}
              onChange={(e) => {
                setBulkDim(e.target.value)
                setBulkVal('')
              }}
            >
              {dimensions.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="input text-sm py-1"
              value={bulkVal}
              onChange={(e) => setBulkVal(e.target.value)}
            >
              <option value="">Pick value…</option>
              {bulkDimObj?.taxonomy_values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="btn-primary py-1 text-sm disabled:opacity-50"
              disabled={!bulkVal || bulkMut.isPending}
              onClick={() =>
                bulkMut.mutate({ ids: [...selected], dim: bulkDim, val: bulkVal })
              }
            >
              Apply
            </button>
          </div>
        )}

        <span className="ml-auto text-sm text-gray-400">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected ? new Set() : new Set(filtered.map((p) => p.id)),
                    )
                  }
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
              {dimensions.map((d) => (
                <th key={d.id} className="px-3 py-2 text-left font-medium text-gray-600">
                  {d.name}
                </th>
              ))}
              <th className="w-24 px-3 py-2 text-center font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
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
                </td>
                {dimensions.map((d) => {
                  const currentVal = p.final_categories?.[d.name] ?? ''
                  const aiAssignment = p.ai_categories?.find(
                    (a) => a.dimension_name === d.name,
                  )
                  const isEditing =
                    editCell?.productId === p.id && editCell.dimName === d.name

                  return (
                    <td key={d.id} className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="input py-0.5 text-sm"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                          >
                            {d.taxonomy_values.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <button
                            className="text-green-600 hover:text-green-800"
                            onClick={() => commitEdit(p)}
                          >
                            ✓
                          </button>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => setEditCell(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          className="group flex items-center gap-1 text-left"
                          onClick={() => startEdit(p.id, d.name, currentVal)}
                        >
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              currentVal === 'Unknown' || !currentVal
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-blue-50 text-blue-800'
                            }`}
                          >
                            {currentVal || '—'}
                          </span>
                          {aiAssignment && aiAssignment.confidence != null && (
                            <span className="text-xs text-gray-300 group-hover:text-gray-400">
                              {Math.round(aiAssignment.confidence * 100)}%
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-center">
                  <button
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.categorized
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
                    }`}
                    onClick={() =>
                      patchMut.mutate({ productId: p.id, data: { categorized: !p.categorized } })
                    }
                  >
                    {p.categorized ? '✓ Done' : 'Mark done'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            No products to review.
          </div>
        )}
      </div>
    </div>
  )
}
