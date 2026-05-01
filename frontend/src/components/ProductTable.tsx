import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import { Product, Dimension } from '../types'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface Props {
  products: Product[]
  dimensions: Dimension[]
  total: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
}

const helper = createColumnHelper<Product>()

export default function ProductTable({
  products,
  dimensions,
  total,
  page,
  perPage,
  onPageChange,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo(() => {
    // Find common data columns (show first 6 key fields)
    const keyFields = ['ASIN', 'Title', 'Brand', 'Price', 'Monthly Revenue', 'Rating']
    const dataCols = keyFields.map((field) =>
      helper.accessor((row) => row.data[field] ?? '', {
        id: `data_${field}`,
        header: field,
        cell: (info) => (
          <span className="text-xs text-gray-700 truncate max-w-[160px] block" title={info.getValue() ?? ''}>
            {info.getValue() || '—'}
          </span>
        ),
      }),
    )

    const dimCols = dimensions
      .filter((d) => d.approved)
      .map((dim) =>
        helper.accessor((row) => row.final_categories?.[dim.name] ?? '', {
          id: `cat_${dim.id}`,
          header: dim.name,
          cell: (info) => {
            const val = info.getValue()
            return val ? (
              <span className="badge bg-brand-100 text-brand-700">{val}</span>
            ) : (
              <span className="text-gray-300 text-xs">—</span>
            )
          },
        }),
      )

    return [...dataCols, ...dimCols]
  }, [dimensions])

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / perPage),
  })

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <span className="text-sm text-gray-500">{total.toLocaleString()} products</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 max-w-[200px]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              className="btn-secondary px-2 py-1"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              ‹ Prev
            </button>
            <button
              className="btn-secondary px-2 py-1"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
