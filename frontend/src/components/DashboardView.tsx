import { DashboardData } from '../types'
import { downloadExcel } from '../api/projects'
import toast from 'react-hot-toast'

const LABEL_COLORS: Record<string, string> = {
  'Exact Target':           'bg-green-500',
  'Close Target':           'bg-lime-500',
  'Functional Alternative': 'bg-yellow-400',
  'Related but Different':  'bg-orange-400',
  'Not Relevant':           'bg-red-400',
}

interface Props {
  projectId: number
  originalFilename: string | null
  data: DashboardData
}

export default function DashboardView({ projectId, originalFilename, data }: Props) {
  const maxRelevanceCount = Math.max(...data.relevance_summary.map((r) => r.count), 1)

  const handleExport = async () => {
    try {
      const filename = (originalFilename ?? 'export').replace(/\.[^/.]+$/, '') + '_categorized.xlsx'
      await downloadExcel(projectId, filename)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total products" value={data.total_products} />
        <StatCard label="Kept" value={data.kept_count} color="text-green-600" />
        <StatCard label="Excluded" value={data.excluded_count} color="text-red-500" />
        <StatCard label="Categorized" value={data.categorized_count} color="text-blue-600" />
      </div>

      {/* Relevance breakdown */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Relevance Breakdown
        </h3>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Label</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Kept</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Excluded</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Pending</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.relevance_summary.map((row) => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{row.label}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{row.count}</td>
                  <td className="px-4 py-2 text-right text-green-600">{row.kept}</td>
                  <td className="px-4 py-2 text-right text-red-500">{row.excluded}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{row.pending}</td>
                  <td className="px-4 py-2 w-40">
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full ${LABEL_COLORS[row.label] ?? 'bg-gray-400'}`}
                        style={{ width: `${(row.count / maxRelevanceCount) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dimension pivot tables */}
      {data.dimension_breakdowns.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Category Breakdowns
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {data.dimension_breakdowns.map((dim) => {
              const entries = Object.entries(dim.values).sort((a, b) => b[1] - a[1])
              const maxCount = Math.max(...entries.map(([, c]) => c), 1)
              return (
                <div key={dim.dimension_name} className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-100 px-4 py-2">
                    <span className="font-medium text-gray-800">{dim.dimension_name}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {entries.map(([val, count]) => (
                      <div key={val} className="flex items-center gap-2 text-sm">
                        <span className="w-36 truncate text-gray-700" title={val}>
                          {val}
                        </span>
                        <div className="flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-blue-400"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-gray-500">{count}</span>
                      </div>
                    ))}
                    {entries.length === 0 && (
                      <p className="text-xs text-gray-400">No categorized products yet</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Export */}
      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button className="btn-primary" onClick={handleExport}>
          Download Excel export
        </button>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  )
}
