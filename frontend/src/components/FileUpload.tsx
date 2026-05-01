import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, FileText, X } from 'lucide-react'

interface Props {
  onUpload: (file: File) => void
  uploading: boolean
}

export default function FileUpload({ onUpload, uploading }: Props) {
  const [preview, setPreview] = useState<File | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      setPreview(file)
      onUpload(file)
    },
    [onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'}
          ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto w-10 h-10 text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? 'Drop file here' : 'Drag & drop your Helium 10 export here'}
        </p>
        <p className="text-xs text-gray-500 mt-1">CSV, XLSX, or XLS · max 50 MB</p>
      </div>

      {preview && !uploading && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <FileText className="w-5 h-5 text-blue-500 shrink-0" />
          <span className="text-sm text-blue-800 truncate flex-1">{preview.name}</span>
          <button
            onClick={() => setPreview(null)}
            className="text-blue-400 hover:text-blue-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploading && (
        <p className="text-sm text-center text-gray-500 animate-pulse">Uploading and parsing…</p>
      )}
    </div>
  )
}
