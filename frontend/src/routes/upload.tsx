import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../api/client'
import { useAuth } from '../api/useAuth'
import type { Dataset, Model } from '../api/schemas'
import { 
  Database, 
  Cpu, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Plus, 
  Activity,
  Layers,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type DatasetAsset = {
  id: number
  name: string
  created_at?: string
  file_format?: string
  target_column?: string
}

type ModelAsset = {
  id: number
  name: string
  created_at?: string
  framework?: string
  task_type?: string
}

interface PresignedResponse {
  fields: Record<string, string>
  upload_url: string
  key: string
}

export function UploadPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [datasetFile, setDatasetFile] = useState<File | null>(null)
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [datasetError, setDatasetError] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const [datasetProgress, setDatasetProgress] = useState(0)
  const [modelProgress, setModelProgress] = useState(0)
  const [target, setTarget] = useState('label')
  const [framework, setFramework] = useState('sklearn')

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets, enabled: Boolean(user) })
  const models = useQuery({ queryKey: ['models'], queryFn: api.listModels, enabled: Boolean(user) })

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/auth' })
    }
  }, [authLoading, user, navigate])

  const datasetMaxMB = 200
  const modelMaxMB = 500

  const handleDatasetFile = (file: File | null) => {
    setDatasetProgress(0)
    setDatasetFile(null)
    const error = validateFile(file, ['csv', 'parquet'], datasetMaxMB)
    setDatasetError(error)
    if (!error) setDatasetFile(file)
  }

  const handleModelFile = (file: File | null) => {
    setModelProgress(0)
    setModelFile(null)
    const error = validateFile(file, ['pkl', 'joblib', 'pt', 'pth', 'bin'], modelMaxMB)
    setModelError(error)
    if (!error) setModelFile(file)
  }

  const validateFile = (file: File | null, allowedExts: string[], maxMB: number) => {
    if (!file) return null
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExts.includes(ext)) return `Formato inválido. Usa: ${allowedExts.join(', ')}`
    const sizeMB = file.size / 1024 / 1024
    if (sizeMB > maxMB) return `Tamaño máximo ${maxMB}MB`
    return null
  }

  const uploadToS3 = async (presigned: PresignedResponse, file: File, onProgress: (p: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      const fd = new FormData()
      Object.entries(presigned.fields || {}).forEach(([k, v]) => fd.append(k, String(v)))
      fd.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', presigned.upload_url)

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100)
          onProgress(Math.min(percent, 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100)
          resolve()
        } else {
          reject(new Error(xhr.responseText || 'S3 upload failed'))
        }
      }

      xhr.onerror = () => reject(new Error('Network error uploading to S3'))

      xhr.send(fd)
    })
  }

  const uploadDataset = useMutation({
    mutationFn: async () => {
      if (!datasetFile) throw new Error('Select a dataset file')
      setDatasetProgress(0)
      const presignFd = new FormData()
      presignFd.append('filename', datasetFile.name)
      presignFd.append('content_type', datasetFile.type || 'text/csv')
      const presigned = await api.presignDataset(presignFd) as PresignedResponse
      await uploadToS3(presigned, datasetFile, setDatasetProgress)
      const confirmFd = new FormData()
      confirmFd.append('key', presigned.key)
      confirmFd.append('filename', datasetFile.name)
      confirmFd.append('target_column', target)
      confirmFd.append('name', datasetFile.name)
      return api.confirmDataset(confirmFd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['datasets'] })
      setDatasetFile(null)
      setDatasetError(null)
      setDatasetProgress(0)
    },
  })

  const uploadModel = useMutation({
    mutationFn: async () => {
      if (!modelFile) throw new Error('Select a model file')
      setModelProgress(0)
      const presignFd = new FormData()
      presignFd.append('filename', modelFile.name)
      presignFd.append('content_type', modelFile.type || 'application/octet-stream')
      const presigned = await api.presignModel(presignFd) as PresignedResponse
      await uploadToS3(presigned, modelFile, setModelProgress)
      const confirmFd = new FormData()
      confirmFd.append('key', presigned.key)
      confirmFd.append('filename', modelFile.name)
      confirmFd.append('framework', framework)
      confirmFd.append('task_type', 'classification')
      confirmFd.append('description', 'uploaded via UI')
      confirmFd.append('name', modelFile.name)
      return api.confirmModel(confirmFd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['models'] })
      setModelFile(null)
      setModelError(null)
      setModelProgress(0)
    },
  })

  const deleteDatasetMut = useMutation({
    mutationFn: async (id: number) => {
      await api.deleteDataset(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['datasets'] }),
  })

  const deleteModelMut = useMutation({
    mutationFn: async (id: number) => {
      await api.deleteModel(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  })

  const datasetList = ((datasets.data as Dataset[] | undefined) ?? []) as DatasetAsset[]
  const modelList = ((models.data as Model[] | undefined) ?? []) as ModelAsset[]

  if (authLoading || (!user && authLoading === false)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide animate-pulse">Accessing secure asset vault...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] mb-2">Asset Management</h1>
          <p className="text-[var(--text-muted)] font-medium">Upload and manage model artifacts and data</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-emerald-500">
            <Activity className="h-3.5 w-3.5" />
            LIVE SYSTEM OPERATIONAL
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Datasets" value={datasetList.length} icon={Database} color="emerald" />
        <StatCard label="Models" value={modelList.length} icon={Cpu} color="blue" />
        <StatCard label="Quota Used" value={`${Math.min((datasetList.length + modelList.length) * 4, 100)}%`} icon={Layers} color="amber" />
        <StatCard label="Security" value="Encrypted" icon={ShieldCheck} color="cyan" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,350px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <UploadForm
              title="Datasets"
              icon={<Database className="w-5 h-5 text-emerald-500" />}
              description="CSV or Parquet resources"
              onFile={handleDatasetFile}
              selectedFile={datasetFile}
              accept=".csv,.parquet"
              onSubmit={() => uploadDataset.mutate()}
              isLoading={uploadDataset.isPending}
              error={uploadDataset.error as Error}
              success={uploadDataset.isSuccess}
              progress={datasetProgress}
              validationError={datasetError}
              helper={`Formatos: CSV/Parquet · Máx ${datasetMaxMB}MB`}
              fields={
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Target Column</label>
                  <input
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/50 px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="e.g. target, label"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>
              }
            />
            <UploadForm
              title="Models"
              icon={<Cpu className="w-5 h-5 text-blue-500" />}
              description="Model artifacts & weights"
              onFile={handleModelFile}
              selectedFile={modelFile}
              accept=".pkl,.joblib,.pt,.pth,.bin"
              onSubmit={() => uploadModel.mutate()}
              isLoading={uploadModel.isPending}
              error={uploadModel.error as Error}
              success={uploadModel.isSuccess}
              progress={modelProgress}
              validationError={modelError}
              helper={`Formatos: pkl/joblib/pt/pth/bin · Máx ${modelMaxMB}MB`}
              fields={
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Framework</label>
                  <select
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/50 px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                  >
                    <option value="sklearn">Scikit-learn</option>
                    <option value="xgboost">XGBoost</option>
                    <option value="pytorch">PyTorch</option>
                    <option value="tensorflow">TensorFlow</option>
                  </select>
                </div>
              }
            />
          </div>

          <InventorySection 
            datasets={datasetList} 
            models={modelList} 
            loading={datasets.isLoading || models.isLoading}
            onDeleteDataset={(id: number) => deleteDatasetMut.mutate(id)}
            onDeleteModel={(id: number) => deleteModelMut.mutate(id)}
          />
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3 border-b border-[var(--card-border)] pb-4">
              <Activity className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold uppercase tracking-tight text-sm text-[var(--text)]">System Quota</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg)]/30 rounded-2xl border border-[var(--card-border)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Storage</span>
                  <span className="text-[10px] font-mono font-bold text-amber-500">{Math.min((datasetList.length + modelList.length) * 4, 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--card-border)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                    style={{ width: `${Math.min((datasetList.length + modelList.length) * 4, 100)}%` }} 
                  />
                </div>
              </div>
              <QuickGuides />
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-[2rem] border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="h-5 w-5 text-amber-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-500">Security Guard</h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
                  Assets are scanned for malicious hooks and adversarial patterns before encryption.
              </p>
          </div>
        </div>
      </div>
    </div>
  )
}

type StatColor = 'emerald' | 'blue' | 'amber' | 'cyan'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  color: StatColor
}) {
  const colors: Record<StatColor, string> = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  }

  return (
    <div className="glass-card p-5 rounded-2xl group cursor-default">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-transform group-hover:scale-110 ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--text)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

type UploadFormProps = {
  title: string
  icon: React.ReactNode
  description: string
  onFile: (file: File | null) => void
  selectedFile: File | null
  accept: string
  onSubmit: () => void
  isLoading: boolean
  error: Error | null
  success: boolean
  fields?: React.ReactNode
  progress?: number
  validationError?: string | null
  helper?: string
}

function UploadForm({
  title,
  icon,
  description,
  onFile,
  selectedFile,
  accept,
  onSubmit,
  isLoading,
  error,
  success,
  fields,
  progress,
  validationError,
  helper,
}: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const safeProgress = progress ?? 0
  
  return (
    <div className="glass-card p-6 rounded-[2rem]">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-[var(--bg)]/50 rounded-2xl border border-[var(--card-border)]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text)] tracking-tight">{title}</h2>
          <p className="text-xs text-[var(--text-muted)] font-medium">{description}</p>
        </div>
      </div>

      <div className="space-y-5">
        <div 
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3 ${
            selectedFile ? 'border-amber-500/50 bg-amber-500/5' : 'border-[var(--card-border)] hover:border-amber-500/30 bg-[var(--bg)]/30'
          }`}
        >
          <input 
            type="file" 
            ref={inputRef} 
            className="hidden" 
            accept={accept}
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
          {selectedFile ? (
            <>
              <FileText className="w-8 h-8 text-amber-500" />
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--text)] truncate max-w-[200px]">{selectedFile.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-[var(--text-muted)] opacity-30" />
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Drop file to secure</p>
            </>
          )}
        </div>

        {helper && (
          <p className="text-[11px] text-[var(--text-muted)] font-medium">{helper}</p>
        )}

        {validationError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold uppercase">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{validationError}</p>
          </div>
        )}

        {fields}

        <button
          onClick={onSubmit}
          disabled={!selectedFile || isLoading || Boolean(validationError)}
          className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
            !selectedFile || isLoading || validationError
              ? 'bg-[var(--card-border)] text-[var(--text-muted)] cursor-not-allowed' 
              : 'bg-[var(--text)] text-[var(--bg)] hover:opacity-90 shadow-lg'
          }`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Store Asset</>}
        </button>

        {safeProgress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
              <span>Upload</span>
              <span>{safeProgress}%</span>
            </div>
            <div className="h-2 w-full bg-[var(--card-border)] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${safeProgress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold uppercase">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error.message}</p>
          </div>
        )}
        
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p>Ready in vault</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InventorySection({
  datasets,
  models,
  loading,
  onDeleteDataset,
  onDeleteModel,
}: {
  datasets: DatasetAsset[]
  models: ModelAsset[]
  loading: boolean
  onDeleteDataset: (id: number) => void
  onDeleteModel: (id: number) => void
}) {
  const [activeTab, setActiveTab] = useState('datasets')

  return (
    <div className="glass-card rounded-[2.5rem] overflow-hidden">
      <div className="px-8 py-6 border-b border-[var(--card-border)] flex items-center justify-between">
        <div>
            <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Inventory</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-medium">Verified assets in secure storage</p>
        </div>
        <div className="flex p-1 bg-[var(--bg)]/50 rounded-xl border border-[var(--card-border)]">
          <button 
            onClick={() => setActiveTab('datasets')}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'datasets' ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            Datasets
          </button>
          <button 
            onClick={() => setActiveTab('models')}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'models' ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            Models
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--card-border)]">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="p-8 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--card-border)] rounded-2xl" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-[var(--card-border)] rounded w-1/4" />
                <div className="h-3 bg-[var(--card-border)] rounded w-1/3" />
              </div>
            </div>
          ))
        ) : (activeTab === 'datasets' ? datasets : models).length === 0 ? (
          <div className="p-16 text-center text-[var(--text-muted)] opacity-30 text-xs font-bold uppercase tracking-widest">
            No assets detected
          </div>
        ) : (
          <>
            {activeTab === 'datasets'
              ? datasets.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 flex items-center justify-between hover:bg-[var(--text)]/5 transition-colors group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="p-3 bg-[var(--bg)]/50 rounded-2xl border border-[var(--card-border)] group-hover:border-amber-500/30 transition-all">
                        <Database className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text)] tracking-tight">{item.name}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest px-2 py-0.5 border border-[var(--card-border)] rounded-md">
                            {item.file_format || 'CSV'}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-medium italic">
                            {`target: ${item.target_column || 'none'}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ConfirmDeleteButton onConfirm={() => onDeleteDataset(item.id)} label="Delete dataset" />
                  </div>
                ))
              : models.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 flex items-center justify-between hover:bg-[var(--text)]/5 transition-colors group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="p-3 bg-[var(--bg)]/50 rounded-2xl border border-[var(--card-border)] group-hover:border-amber-500/30 transition-all">
                        <Cpu className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text)] tracking-tight">{item.name}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest px-2 py-0.5 border border-[var(--card-border)] rounded-md">
                            {item.framework || 'ARCH'}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-medium italic">
                            {item.task_type || 'classification'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ConfirmDeleteButton onConfirm={() => onDeleteModel(item.id)} label="Delete model" />
                  </div>
                ))}
          </>
        )}
      </div>
    </div>
  )
}

function ConfirmDeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 hover:bg-rose-500/10 rounded-xl transition-colors text-[var(--text-muted)] hover:text-rose-500"
        title={label}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--bg)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text)]">Confirmar eliminación</p>
                <p className="text-[11px] text-[var(--text-muted)]">Esto también eliminará análisis asociados.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOpen(false)
                  onConfirm()
                }}
                className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition-colors"
              >
                Eliminar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--card-border)] text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:bg-[var(--text)]/5 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function QuickGuides() {
  const guides = [
    { title: 'Data standards', icon: <FileText className="w-4 h-4" /> },
    { title: 'Artifact formats', icon: <Cpu className="w-4 h-4" /> },
    { title: 'Secure transfer', icon: <ShieldCheck className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-2">
      {guides.map((guide, i) => (
        <button key={i} className="w-full p-4 flex items-center justify-between rounded-2xl border border-[var(--card-border)] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
          <div className="flex items-center gap-3">
            <div className="text-[var(--text-muted)] group-hover:text-amber-500 transition-colors">
              {guide.icon}
            </div>
            <span className="text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--text)]">{guide.title}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-all" />
        </button>
      ))}
    </div>
  )
}
