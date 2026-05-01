import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dimension, DimensionDraft } from '../types'
import { Plus, Trash2, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react'
import { lockDimension, unlockDimension, deleteDimension } from '../api/categorization'

interface Props {
  projectId: number
  dimensions: Dimension[]
  onSave: (drafts: DimensionDraft[]) => void
  onLockAll: () => void
  saving: boolean
  lockingAll: boolean
}

function emptyDraft(order: number): DimensionDraft {
  return { name: '', description: '', taxonomy_values: ['Unknown'], approved: false, order }
}

export default function DimensionEditor({
  projectId,
  dimensions,
  onSave,
  onLockAll,
  saving,
  lockingAll,
}: Props) {
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<DimensionDraft[]>([])
  const [expanded, setExpanded] = useState<number | null>(0)
  const [valueInputs, setValueInputs] = useState<Record<number, string>>({})

  useEffect(() => {
    setDrafts(
      dimensions.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? '',
        taxonomy_values: d.taxonomy_values,
        approved: d.approved,
        order: d.order,
      })),
    )
  }, [dimensions])

  const lockMut = useMutation({
    mutationFn: (dimId: number) => lockDimension(projectId, dimId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dimensions', projectId] })
      toast.success('Dimension locked')
    },
    onError: () => toast.error('Failed to lock dimension'),
  })

  const unlockMut = useMutation({
    mutationFn: (dimId: number) => unlockDimension(projectId, dimId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dimensions', projectId] })
      toast.success('Dimension unlocked')
    },
    onError: () => toast.error('Failed to unlock dimension'),
  })

  const deleteMut = useMutation({
    mutationFn: (dimId: number) => deleteDimension(projectId, dimId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dimensions', projectId] })
      toast.success('Dimension deleted')
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Failed to delete dimension'),
  })

  const update = (idx: number, patch: Partial<DimensionDraft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))

  const addDimension = () => {
    setDrafts((prev) => [...prev, emptyDraft(prev.length)])
    setExpanded(drafts.length)
  }

  const removeDraft = (idx: number) => {
    const draft = drafts[idx]
    if (draft.id) {
      deleteMut.mutate(draft.id)
    } else {
      setDrafts((prev) => prev.filter((_, i) => i !== idx))
    }
  }

  const addValue = (idx: number) => {
    const raw = (valueInputs[idx] ?? '').trim()
    if (!raw) return
    const current = drafts[idx].taxonomy_values
    if (current.includes(raw)) {
      toast.error('Value already exists')
      return
    }
    // Keep "Unknown" last
    const withoutUnknown = current.filter((v) => v.toLowerCase() !== 'unknown')
    update(idx, { taxonomy_values: [...withoutUnknown, raw, 'Unknown'] })
    setValueInputs((prev) => ({ ...prev, [idx]: '' }))
  }

  const removeValue = (idx: number, val: string) => {
    if (val.toLowerCase() === 'unknown') {
      toast.error('"Unknown" is required as a catch-all value')
      return
    }
    update(idx, {
      taxonomy_values: drafts[idx].taxonomy_values.filter((v) => v !== val),
    })
  }

  const allLocked = dimensions.length > 0 && dimensions.every((d) => d.approved)

  return (
    <div className="space-y-3">
      {drafts.map((draft, idx) => {
        const isLocked = draft.approved
        const isOpen = expanded === idx

        return (
          <div
            key={draft.id ?? `new-${idx}`}
            className={`rounded-lg border ${
              isLocked
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            {/* Header row */}
            <div
              className="flex cursor-pointer items-center gap-3 px-4 py-3"
              onClick={() => setExpanded(isOpen ? null : idx)}
            >
              {isLocked ? (
                <Lock size={14} className="shrink-0 text-indigo-500" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}

              <span className="flex-1 font-medium text-gray-900">
                {draft.name || <span className="italic text-gray-400">Untitled dimension</span>}
              </span>

              <span className="text-xs text-gray-400">
                {draft.taxonomy_values.length} values
              </span>

              {isLocked ? (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Locked
                </span>
              ) : null}

              {isOpen ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </div>

            {/* Body */}
            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Dimension name</label>
                    <input
                      className="input"
                      value={draft.name}
                      disabled={isLocked}
                      onChange={(e) => update(idx, { name: e.target.value })}
                      placeholder="e.g. Material Type"
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input
                      className="input"
                      value={draft.description}
                      disabled={isLocked}
                      onChange={(e) => update(idx, { description: e.target.value })}
                      placeholder="What this dimension measures"
                    />
                  </div>
                </div>

                {/* Taxonomy values */}
                <div>
                  <label className="label">
                    Taxonomy values{' '}
                    <span className="font-normal text-gray-400">
                      (must end with "Unknown")
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {draft.taxonomy_values.map((val) => (
                      <span
                        key={val}
                        className={`flex items-center gap-1 rounded-full px-3 py-0.5 text-sm ${
                          val.toLowerCase() === 'unknown'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-50 text-blue-800'
                        }`}
                      >
                        {val}
                        {!isLocked && val.toLowerCase() !== 'unknown' && (
                          <button
                            className="hover:text-red-500"
                            onClick={() => removeValue(idx, val)}
                          >
                            Ã—
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {!isLocked && (
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Add value…"
                        value={valueInputs[idx] ?? ''}
                        onChange={(e) =>
                          setValueInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && addValue(idx)}
                      />
                      <button className="btn-primary px-4" onClick={() => addValue(idx)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                  {draft.id && (
                    isLocked ? (
                      <button
                        className="flex items-center gap-1.5 rounded border border-indigo-200 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100"
                        onClick={() => unlockMut.mutate(draft.id!)}
                        disabled={unlockMut.isPending}
                      >
                        <Unlock size={13} />
                        Unlock
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100 disabled:opacity-50"
                        onClick={() => lockMut.mutate(draft.id!)}
                        disabled={draft.taxonomy_values.length < 2 || lockMut.isPending}
                        title={draft.taxonomy_values.length < 2 ? 'Need at least 2 values to lock' : ''}
                      >
                        <Lock size={13} />
                        Lock this dimension
                      </button>
                    )
                  )}

                  {!isLocked && (
                    <button
                      className="ml-auto flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                      onClick={() => removeDraft(idx)}
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button className="btn-secondary flex items-center gap-1.5" onClick={addDimension}>
          <Plus size={14} />
          Add dimension
        </button>

        <button
          className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          onClick={() => onSave(drafts)}
          disabled={saving || drafts.some((d) => d.approved)}
        >
          {saving ? 'Saving…' : 'Save all'}
        </button>

        {!allLocked && dimensions.length > 0 && (
          <button
            className="ml-auto flex items-center gap-1.5 rounded border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            onClick={onLockAll}
            disabled={lockingAll || dimensions.some((d) => d.taxonomy_values.length < 2)}
          >
            <Lock size={14} />
            {lockingAll ? 'Locking…' : 'Lock all & proceed to categorization'}
          </button>
        )}

        {allLocked && (
          <span className="ml-auto flex items-center gap-1.5 text-sm font-medium text-indigo-600">
            <Lock size={14} />
            All dimensions locked
          </span>
        )}
      </div>
    </div>
  )
}

