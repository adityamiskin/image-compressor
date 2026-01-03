import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Button } from './components/ui/button'
import { ArrowLeft, Download, Maximize2, X } from 'lucide-react'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'
import { cn } from './lib/utils'

const ACCEPT_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/avif']

type JobStatus = 'idle' | 'compressing' | 'done' | 'error'
type ViewMode = 'drop' | 'single' | 'list'

interface CompressionResult {
  blob: Blob
  url: string
  size: number
  savings: number
}

interface Job {
  id: string
  file: File
  name: string
  type: string
  size: number
  width: number
  height: number
  originalUrl: string
  status: JobStatus
  slider: number
  result?: CompressionResult
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[exponent]}`
}

const formatSavings = (delta: number) => {
  const sign = delta >= 0 ? '-' : '+'
  return `${sign}${Math.abs(delta).toFixed(1)}%`
}

const clampDimension = (value: number) => {
  if (Number.isNaN(value)) return 1
  return Math.max(1, Math.min(16384, value))
}

const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(url)
    }
    img.onerror = reject
    img.src = url
  })
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const Compress: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('drop')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [quality, setQuality] = useState(85)
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp' | 'avif'>('jpeg')
  const [resizeEnabled, setResizeEnabled] = useState(false)
  const [resizeWidth, setResizeWidth] = useState(1920)
  const [resizeHeight, setResizeHeight] = useState(1080)
  const [keepAspect, setKeepAspect] = useState(true)
  const [dropActive, setDropActive] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 4>(1)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const jobsRef = useRef<Job[]>(jobs)
  const recompressTimer = useRef<number | null>(null)

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const selectedJob = useMemo(() => {
    if (selectedJobId) {
      return jobs.find((job) => job.id === selectedJobId) ?? null
    }
    return jobs.length === 1 ? jobs[0] : null
  }, [jobs, selectedJobId])

  const hasMultipleJobs = jobs.length > 1

  useEffect(() => {
    if (jobs.length === 0) {
      setViewMode('drop')
      setSelectedJobId(null)
      setZoomLevel(1)
      return
    }

    if (jobs.length === 1) {
      setSelectedJobId(jobs[0].id)
      if (viewMode === 'drop') {
        setViewMode('single')
      }
      return
    }

    if (jobs.length > 1 && viewMode === 'drop') {
      setViewMode('list')
    }
  }, [jobs, viewMode])

  useEffect(() => {
    setZoomLevel(1)
  }, [selectedJobId])

  useEffect(() => {
    if (!viewMode.startsWith('single') && resizeEnabled) {
      setResizeEnabled(false)
    }
  }, [viewMode, resizeEnabled])

  useEffect(() => {
    return () => {
      jobsRef.current.forEach((job) => {
        URL.revokeObjectURL(job.originalUrl)
        if (job.result?.url) URL.revokeObjectURL(job.result.url)
      })
    }
  }, [])

  const compressJob = useCallback(async (job: Job) => {
    setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, status: 'compressing' } : item)))

    try {
      const options = {
        useWebWorker: true,
        initialQuality: quality / 100,
        maxWidthOrHeight: resizeEnabled ? Math.max(resizeWidth, resizeHeight) : undefined,
      }

      let mimeType: string
      switch (outputFormat) {
        case 'jpeg':
          mimeType = 'image/jpeg'
          break
        case 'png':
          mimeType = 'image/png'
          break
        case 'webp':
          mimeType = 'image/webp'
          break
        case 'avif':
          mimeType = 'image/avif'
          break
        default:
          mimeType = job.type
      }

      const compressedFile = await imageCompression(job.file, { ...options, fileType: mimeType })
      const url = URL.createObjectURL(compressedFile)

      setJobs((prev) =>
        prev.map((item) => {
          if (item.id !== job.id) return item
          if (item.result?.url) URL.revokeObjectURL(item.result.url)
          const savings = item.size > 0 ? ((item.size - compressedFile.size) / item.size) * 100 : 0
          return {
            ...item,
            status: 'done',
            result: {
              blob: compressedFile,
              url,
              size: compressedFile.size,
              savings,
            },
          }
        }),
      )
    } catch (error) {
      console.error('Compression failed', error)
      setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, status: 'error' } : item)))
    }
  }, [quality, resizeEnabled, resizeHeight, resizeWidth])

  const recompressAll = useCallback(() => {
    jobsRef.current.forEach((job) => {
      if (job.status === 'done' || job.status === 'error') {
        compressJob(job)
      }
    })
  }, [compressJob])

  const queueRecompress = useCallback(() => {
    if (recompressTimer.current) {
      window.clearTimeout(recompressTimer.current)
    }
    recompressTimer.current = window.setTimeout(() => {
      recompressAll()
    }, 400)
  }, [recompressAll])

  const handleQualityChange = (value: number) => {
    setQuality(value)
    queueRecompress()
  }

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => ACCEPT_MIME.includes(file.type))
    if (!files.length) return

    const newJobs: Job[] = []
    for (const file of files) {
      try {
        const { width, height } = await getImageDimensions(file)
        newJobs.push({
          id: generateId(),
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          width,
          height,
          originalUrl: URL.createObjectURL(file),
          status: 'idle',
          slider: 50,
        })
      } catch (error) {
        console.error('Failed to read file', error)
      }
    }

    if (!newJobs.length) return

    setJobs((prev) => [...prev, ...newJobs])

    if (jobs.length + newJobs.length === 1) {
      setViewMode('single')
      setSelectedJobId(newJobs[0].id)
      setResizeWidth(newJobs[0].width)
      setResizeHeight(newJobs[0].height)
    } else {
      setViewMode('list')
    }

    for (const job of newJobs) {
      compressJob(job)
    }
  }, [compressJob, jobs.length])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files)
      event.target.value = ''
    }
  }

  const triggerFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDropActive(false)
    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDropActive(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = event
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDropActive(false)
    }
  }

  const selectJob = (id: string) => {
    const job = jobs.find((j) => j.id === id)
    if (job) {
      setResizeWidth(job.width)
      setResizeHeight(job.height)
    }
    setSelectedJobId(id)
    setViewMode('single')
  }

  const goBackToList = () => {
    setViewMode('list')
    setSelectedJobId(null)
    setZoomLevel(1)
  }

  const removeJob = (id: string) => {
    const target = jobs.find((job) => job.id === id)
    if (target) {
      URL.revokeObjectURL(target.originalUrl)
      if (target.result?.url) URL.revokeObjectURL(target.result.url)
    }
    const next = jobs.filter((job) => job.id !== id)
    setJobs(next)

    if (!next.length) {
      setViewMode('drop')
      setSelectedJobId(null)
      setZoomLevel(1)
      return
    }

    if (selectedJobId === id) {
      if (next.length === 1) {
        setSelectedJobId(next[0].id)
        setViewMode('single')
      } else {
        setSelectedJobId(null)
        setViewMode('list')
      }
    }
  }

  const clearAll = () => {
    jobs.forEach((job) => {
      URL.revokeObjectURL(job.originalUrl)
      if (job.result?.url) URL.revokeObjectURL(job.result.url)
    })
    setJobs([])
    setSelectedJobId(null)
    setViewMode('drop')
    setZoomLevel(1)
  }

  const handleDownloadSingle = (job: Job) => {
    if (!job.result) return
    const ext = outputFormat
    const baseName = job.name.replace(/\.[^/.]+$/, '')
    const fileName = `${baseName}_compressed.${ext}`
    saveAs(job.result.blob, fileName)
  }

  const handleDownloadAll = async () => {
    const readyJobs = jobs.filter((job) => job.result)
    if (!readyJobs.length) return

    if (readyJobs.length === 1 && readyJobs[0].result) {
      handleDownloadSingle(readyJobs[0])
      return
    }

    const zip = new JSZip()
    readyJobs.forEach((job) => {
      if (job.result) {
        const ext = outputFormat
        const baseName = job.name.replace(/\.[^/.]+$/, '')
        const fileName = `${baseName}_compressed.${ext}`
        zip.file(fileName, job.result.blob)
      }
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `compressed-images.${outputFormat}.zip`)
  }

  const totalOriginal = useMemo(() => jobs.reduce((sum, job) => sum + job.size, 0), [jobs])
  const totalCompressed = useMemo(() => jobs.reduce((sum, job) => sum + (job.result?.size ?? job.size), 0), [jobs])
  const totalSavingsPct = totalOriginal > 0 ? ((totalOriginal - totalCompressed) / totalOriginal) * 100 : 0
  const completedJobs = jobs.filter((job) => job.result)
  const isCompressing = jobs.some((job) => job.status === 'compressing')

  const showResizeOption = viewMode === 'single' && !!selectedJob && !hasMultipleJobs

  const handleResizeToggle = (enabled: boolean) => {
    setResizeEnabled(enabled)
    if (enabled && selectedJob) {
      setResizeWidth(selectedJob.width)
      setResizeHeight(selectedJob.height)
    }
    queueRecompress()
  }

  const handleWidthInput = (value: number) => {
    const nextWidth = clampDimension(value)
    setResizeWidth(nextWidth)
    if (keepAspect && selectedJob) {
      const ratio = selectedJob.height / selectedJob.width
      setResizeHeight(clampDimension(Math.round(nextWidth * ratio)))
    }
    queueRecompress()
  }

  const handleHeightInput = (value: number) => {
    const nextHeight = clampDimension(value)
    setResizeHeight(nextHeight)
    if (keepAspect && selectedJob) {
      const ratio = selectedJob.width / selectedJob.height
      setResizeWidth(clampDimension(Math.round(nextHeight * ratio)))
    }
    queueRecompress()
  }

  const renderDropView = () => (
    <div
      className={cn('flex h-full w-full flex-col items-center justify-center p-6 transition-colors', dropActive ? 'bg-secondary/10' : 'bg-background')}
      data-testid='drop-view'
    >
      <div
        className={cn('flex h-full w-full max-w-3xl flex-col items-center justify-center rounded border-2 border-dashed text-center transition-colors', dropActive ? 'border-primary/70 bg-secondary/20' : 'border-border')}
        onClick={triggerFilePicker}
      >
        <div className='flex flex-col items-center gap-6 text-center'>
          <div className='text-muted-foreground'>
            <Maximize2 className='h-12 w-12 opacity-60' />
          </div>
          <div className='space-y-2'>
            <p className='text-lg text-foreground'>Drop PNG or JPEG files here</p>
            <p className='text-sm text-muted-foreground'>or paste from clipboard</p>
          </div>
          <Button onClick={triggerFilePicker} className='px-6' data-testid='select-files-button'>
            Select Files
          </Button>
          <p className='text-xs text-muted-foreground'>Press ⌘/Ctrl + V to paste</p>
        </div>
      </div>
    </div>
  )

  const renderSingleView = (job: Job) => (
    <div className='relative flex h-full w-full flex-col bg-background' data-testid='single-view'>
      {hasMultipleJobs && (
        <button className='absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted' onClick={goBackToList}>
          <ArrowLeft className='h-4 w-4' />
          <span>Back</span>
        </button>
      )}

      <button
        className='absolute right-3 top-3 z-10 rounded p-1 text-muted-foreground hover:bg-muted'
        onClick={() => (hasMultipleJobs ? goBackToList() : removeJob(job.id))}
        aria-label='Close'
      >
        <X className='h-4 w-4' />
      </button>

      <div className='flex-1 overflow-hidden px-4 pb-10 pt-12 sm:px-8'>
        <div className='flex h-full items-center justify-center'>
          {job.result ? (
            <div
              className='relative'
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}
            >
              <ReactCompareSlider
                position={50}
                itemOne={<ReactCompareSliderImage src={job.originalUrl} alt={job.name} style={{ width: '100%', height: 'auto', maxHeight: 'calc(100vh - 220px)', objectFit: 'contain' }} />}
                itemTwo={<ReactCompareSliderImage src={job.result.url} alt={`${job.name} compressed`} style={{ width: '100%', height: 'auto', maxHeight: 'calc(100vh - 220px)', objectFit: 'contain' }} />}
                style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: 'calc(100vh - 220px)' }}
              />
            </div>
          ) : (
            <div
              className='relative'
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}
            >
              <img
                src={job.originalUrl}
                alt={job.name}
                className='max-h-[calc(100vh-220px)] max-w-full object-contain'
                draggable={false}
              />
            </div>
          )}
        </div>

        <div className='absolute left-4 bottom-4 max-w-[60%] text-xs text-muted-foreground'>
          <p className='truncate'>{job.name}</p>
          <p>
            {job.width} × {job.height}
          </p>
        </div>

        <div className='absolute right-4 bottom-4 flex items-center gap-1 text-xs text-muted-foreground'>
          <span>Zoom</span>
          {[1, 2, 4].map((level) => (
            <button
              key={level}
              className={cn('rounded px-2 py-1 transition-colors', zoomLevel === level ? 'bg-muted text-foreground' : 'hover:bg-muted/60')}
              onClick={() => setZoomLevel(level as 1 | 2 | 4)}
            >
              {level}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderListView = () => (
    <div className='flex h-full w-full flex-col overflow-hidden bg-background' data-testid='list-view'>
      <div className='flex items-center justify-between border-b border-border px-4 py-3 text-xs uppercase tracking-[0.3em] text-muted-foreground'>
        <span>{jobs.length} files</span>
        <div className='flex items-center gap-4'>
          <button onClick={triggerFilePicker} className='hover:text-foreground transition-colors'>
            Add more
          </button>
          <button onClick={clearAll} className='hover:text-foreground transition-colors'>
            Clear all
          </button>
        </div>
      </div>

      <div className='flex-1 space-y-2 overflow-y-auto px-4 py-4'>
        {jobs.map((job) => (
          <div
            key={job.id}
            className='group flex cursor-pointer items-center gap-3 rounded border border-border bg-secondary/20 p-2 hover:border-primary/60'
            onClick={() => selectJob(job.id)}
          >
            <div className='h-10 w-10 overflow-hidden rounded bg-muted'>
              <img src={job.originalUrl} alt='' className='h-full w-full object-cover' />
            </div>
            <div className='flex-1 min-w-0'>
              <p className='truncate text-sm text-foreground'>{job.name}</p>
              <p className='text-xs text-muted-foreground'>
                {job.width} × {job.height}
              </p>
            </div>
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <span>{formatBytes(job.size)}</span>
              <span>→</span>
              <span>{job.result ? formatBytes(job.result.size) : job.status === 'compressing' ? '…' : '--'}</span>
            </div>
            <div className='w-12 text-right text-xs font-semibold'>
              {job.result ? (
                <span className={job.result.savings >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatSavings(job.result.savings)}
                </span>
              ) : job.status === 'error' ? (
                <span className='text-red-500'>Error</span>
              ) : (
                <span className='text-muted-foreground'>--</span>
              )}
            </div>
            <div className='flex items-center gap-1 shrink-0'>
              <button
                className='rounded p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 disabled:opacity-40 w-8 h-8'
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownloadSingle(job)
                }}
                disabled={!job.result}
              >
                <Download className='h-4 w-4' />
              </button>
              <button
                className='rounded p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 w-8 h-8'
                onClick={(e) => {
                  e.stopPropagation()
                  removeJob(job.id)
                }}
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderControlsFooter = () => (
    <footer className='flex flex-col gap-3 border-t border-border bg-background/80 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
      <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
        <div className='flex items-center gap-2'>
          <span>Format</span>
          <select
            value={outputFormat}
            onChange={(e) => { setOutputFormat(e.target.value as typeof outputFormat); queueRecompress() }}
            className='rounded border border-border bg-background px-2 py-1 text-foreground'
          >
            <option value='jpeg'>JPEG</option>
            <option value='png'>PNG</option>
            <option value='webp'>WebP</option>
            <option value='avif'>AVIF</option>
          </select>
        </div>
        <div className='flex items-center gap-2'>
          <span>Quality</span>
          <input
            type='range'
            min={1}
            max={100}
            step={1}
            value={quality}
            onChange={(e) => handleQualityChange(Number(e.target.value))}
            className='w-24'
          />
          <span className='w-8 text-right text-foreground'>{quality}</span>
        </div>
        {showResizeOption && (
          <label className='inline-flex cursor-pointer items-center gap-2'>
            <input
              type='checkbox'
              checked={resizeEnabled}
              onChange={(e) => handleResizeToggle(e.target.checked)}
            />
            <span className='text-foreground'>Resize</span>
          </label>
        )}
      </div>

      {resizeEnabled && showResizeOption && (
        <div className='flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground sm:border-t-0 sm:pt-0'>
          <div className='flex items-center gap-2'>
            <span>Size</span>
            <input
              type='number'
              min={1}
              max={16384}
              value={resizeWidth}
              onChange={(e) => handleWidthInput(Number(e.target.value))}
              className='w-20 rounded border border-border bg-background px-2 py-1 text-foreground'
            />
            <span>×</span>
            <input
              type='number'
              min={1}
              max={16384}
              value={resizeHeight}
              onChange={(e) => handleHeightInput(Number(e.target.value))}
              className='w-20 rounded border border-border bg-background px-2 py-1 text-foreground'
            />
          </div>
          <label className='inline-flex cursor-pointer items-center gap-2'>
            <input type='checkbox' checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />
            <span className='text-foreground'>Keep aspect</span>
          </label>
        </div>
      )}

      <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
        {completedJobs.length > 0 && (
          <>
            <div className='flex items-center gap-2'>
              <span>Original</span>
              <span className='text-foreground'>{formatBytes(totalOriginal)}</span>
            </div>
            <span>→</span>
            <div className='flex items-center gap-2'>
              <span>Compressed</span>
              <span className='text-foreground'>{formatBytes(totalCompressed)}</span>
            </div>
            <span className={totalSavingsPct >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
              {formatSavings(totalSavingsPct)}
            </span>
          </>
        )}
      </div>

      <div className='flex items-center justify-end gap-2 text-xs text-muted-foreground'>
        <Button
          onClick={handleDownloadAll}
          disabled={isCompressing || completedJobs.length === 0}
          className='text-xs font-semibold'
        >
          {isCompressing ? 'Compressing...' : completedJobs.length > 1 ? 'Download All (.zip)' : 'Download'}
        </Button>
      </div>
    </footer>
  )

  return (
    <div className='flex h-svh max-w-full flex-col overflow-hidden bg-background text-foreground'>
      <main
        className='flex-1 overflow-hidden'
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {viewMode === 'drop' && renderDropView()}
        {viewMode === 'single' && selectedJob && renderSingleView(selectedJob)}
        {viewMode === 'list' && renderListView()}
      </main>

      <input
        ref={fileInputRef}
        id='file-input'
        type='file'
        accept={ACCEPT_MIME.join(',')}
        multiple
        className='hidden'
        onChange={handleFileChange}
      />

      {jobs.length > 0 && renderControlsFooter()}
    </div>
  )
}

export default Compress
