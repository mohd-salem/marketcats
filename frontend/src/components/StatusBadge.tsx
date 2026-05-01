import { ProjectStatus } from '../types'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  created:           { label: 'New',               className: 'bg-gray-100 text-gray-600' },
  uploaded:          { label: 'File uploaded',      className: 'bg-blue-100 text-blue-700' },
  relevance_pending: { label: 'Classifying…',       className: 'bg-yellow-100 text-yellow-700' },
  relevance_review:  { label: 'Relevance Review',   className: 'bg-orange-100 text-orange-700' },
  taxonomy_building: { label: 'Building Taxonomy',  className: 'bg-purple-100 text-purple-700' },
  taxonomy_locked:   { label: 'Taxonomy Locked',    className: 'bg-indigo-100 text-indigo-700' },
  categorizing:      { label: 'Categorizing…',      className: 'bg-yellow-100 text-yellow-700' },
  review:            { label: 'Category Review',    className: 'bg-orange-100 text-orange-700' },
  done:              { label: 'Done',               className: 'bg-green-100 text-green-700' },
}

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600',
  }
  return <span className={`badge ${className}`}>{label}</span>
}

