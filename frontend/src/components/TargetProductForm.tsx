import { useState, useEffect } from 'react'
import { TargetProduct } from '../types'
import { Plus, X } from 'lucide-react'

interface Props {
  initial?: TargetProduct | null
  onSave: (data: Partial<TargetProduct>) => void
  saving: boolean
}

export default function TargetProductForm({ initial, onSave, saving }: Props) {
  const [asin, setAsin] = useState(initial?.asin ?? '')
  const [amazonUrl, setAmazonUrl] = useState(initial?.amazon_url ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [mainFunction, setMainFunction] = useState(initial?.main_function ?? '')
  const [exclusionRules, setExclusionRules] = useState<string[]>(
    initial?.exclusion_rules ?? [],
  )
  const [ruleInput, setRuleInput] = useState('')

  // Sync when data arrives async (e.g. query loads after mount)
  useEffect(() => {
    if (!initial) return
    setAsin(initial.asin ?? '')
    setAmazonUrl(initial.amazon_url ?? '')
    setImageUrl(initial.image_url ?? '')
    setDescription(initial.description ?? '')
    setMainFunction(initial.main_function ?? '')
    setExclusionRules(initial.exclusion_rules ?? [])
  }, [initial?.id])

  const addRule = () => {
    const trimmed = ruleInput.trim()
    if (trimmed && !exclusionRules.includes(trimmed)) {
      setExclusionRules((r) => [...r, trimmed])
      setRuleInput('')
    }
  }

  const removeRule = (rule: string) =>
    setExclusionRules((r) => r.filter((x) => x !== rule))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      asin: asin || null,
      amazon_url: amazonUrl || null,
      image_url: imageUrl || null,
      description: description || null,
      main_function: mainFunction || null,
      exclusion_rules: exclusionRules.length ? exclusionRules : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">ASIN</label>
          <input
            className="input"
            placeholder="B0XXXXXXXX"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Amazon URL</label>
          <input
            className="input"
            placeholder="https://www.amazon.com/dp/..."
            value={amazonUrl}
            onChange={(e) => setAmazonUrl(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Product Image URL</label>
        <input
          className="input"
          placeholder="https://..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Text Description</label>
        <textarea
          className="input min-h-[80px] resize-y"
          placeholder="Brief description of the target product…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Main Function / Niche Context</label>
        <textarea
          className="input min-h-[60px] resize-y"
          placeholder="e.g. Portable foam rollers for muscle recovery used by gym-goers…"
          value={mainFunction}
          onChange={(e) => setMainFunction(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-1">
          This context helps the AI suggest better categorization dimensions.
        </p>
      </div>

      <div>
        <label className="label">Exclusion Rules</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Exclude products over 5 kg…"
            value={ruleInput}
            onChange={(e) => setRuleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
          />
          <button type="button" onClick={addRule} className="btn-secondary">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {exclusionRules.length > 0 && (
          <ul className="mt-2 space-y-1">
            {exclusionRules.map((rule) => (
              <li
                key={rule}
                className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5"
              >
                <span className="flex-1 text-red-800">{rule}</span>
                <button
                  type="button"
                  onClick={() => removeRule(rule)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save Target Product'}
      </button>
    </form>
  )
}
