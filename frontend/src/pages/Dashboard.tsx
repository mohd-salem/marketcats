import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, FolderOpen, Clock } from 'lucide-react'
import { listProjects, createProject, deleteProject } from '../api/projects'
import StatusBadge from '../components/StatusBadge'
import { Project } from '../types'

export default function Dashboard() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  const createMutation = useMutation({
    mutationFn: () => createProject(newName.trim(), newDesc.trim() || undefined),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      navigate(`/projects/${project.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(project.id)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Each project corresponds to a Helium 10 export and its categorization
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New project
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-4">New project</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Project name *</label>
              <input
                className="input"
                placeholder="e.g. Foam Rollers – May 2026"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input
                className="input"
                placeholder="Brief notes about this research…"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create project'}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="card cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-semibold text-gray-900 truncate">{project.name}</h2>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.description && (
                    <p className="text-sm text-gray-500 truncate">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {project.original_filename && (
                      <span>{project.original_filename}</span>
                    )}
                    <span>{project.product_count.toLocaleString()} products</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all ml-4"
                  onClick={(e) => handleDelete(e, project)}
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
