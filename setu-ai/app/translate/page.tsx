'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { translateSignClip } from '@/lib/gradio'
import { Navbar } from '@/components/Navbar'
import { CameraFeed } from '@/components/CameraFeed'
import { XAIVisualizer } from '@/components/XAIVisualizer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Play,
  Square,
  Copy,
  Trash2,
  Download,
  FileText,
  Eye,
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

const SPACE_ID = 'Siddhartha121220/isign-translator-demo'

type TranslationState = 'idle' | 'recording' | 'translating' | 'done' | 'error'

export default function TranslatePage() {
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [translationState, setTranslationState] = useState<TranslationState>('idle')
  const [recognizedSentence, setRecognizedSentence] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'camera' | 'xai'>('camera')

  const [sidebarWidth, setSidebarWidth] = useState(288)
  const isDragging = useRef(false)

  const startResize = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      setSidebarWidth(Math.min(480, Math.max(220, e.clientX)))
    }
    function onMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const toggleRecognition = () => {
    if (isRecognizing) {
      setIsRecognizing(false)
      setTranslationState('translating')
    } else {
      setErrorMessage(null)
      setRecognizedSentence('')
      setIsRecognizing(true)
      setTranslationState('recording')
    }
  }

  const handleClipRecorded = async (blob: Blob) => {
    if (blob.size === 0) {
      setTranslationState('idle')
      return
    }

    const startedAt = performance.now()
    try {
      const text = await translateSignClip(blob)
      setRecognizedSentence(text)
      setLatency(Math.round(performance.now() - startedAt))
      setSessionCount((prev) => prev + 1)
      setTranslationState('done')
    } catch (err) {
      console.error('Translation request failed:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Could not reach the translation model. Please try again.')
      setTranslationState('error')
    }
  }

  const clearResults = () => {
    setRecognizedSentence('')
    setErrorMessage(null)
    setTranslationState('idle')
  }
  const copySentence = () => {
    if (recognizedSentence) navigator.clipboard.writeText(recognizedSentence)
  }
  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      sentence: recognizedSentence,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
      model: SPACE_ID
    }, null, 2))
    const a = document.createElement('a')
    a.setAttribute('href', dataStr)
    a.setAttribute('download', 'setu_ai_translation.json')
    a.click()
  }
  const exportText = () => {
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(recognizedSentence)
    const a = document.createElement('a')
    a.setAttribute('href', dataStr)
    a.setAttribute('download', 'setu_ai_translation.txt')
    a.click()
  }

  const statusLabel: Record<TranslationState, string> = {
    idle: 'Idle',
    recording: 'Recording',
    translating: 'Translating',
    done: 'Done',
    error: 'Error',
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Toolbar */}
      <div className="border-b border-border px-4 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-md">
          <button
            onClick={() => setActiveTab('camera')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium transition-colors',
              activeTab === 'camera' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Camera
          </button>
          <button
            onClick={() => setActiveTab('xai')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium transition-colors',
              activeTab === 'xai' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Brain className="h-3.5 w-3.5" />
            XAI Weights
          </button>
        </div>

        <div className={cn(
          'px-2.5 h-7 rounded-md text-xs font-medium border flex items-center gap-1.5',
          translationState === 'error'
            ? 'bg-destructive/10 text-destructive border-destructive/30'
            : translationState === 'translating'
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-chart-2/10 text-chart-2 border-chart-2/30'
        )}>
          {translationState === 'translating' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : translationState === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {statusLabel[translationState]}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside
          style={{ width: sidebarWidth }}
          className="shrink-0 flex flex-col overflow-y-auto"
        >
          <div className="p-4 border-b border-border space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Sessions</p>
                <p className="text-xl font-semibold">{sessionCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Latency</p>
                <p className="text-xl font-semibold">{latency !== null ? `${latency}ms` : '—'}</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-border space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Translation</h2>
            <div className="p-3 rounded-md bg-secondary border border-border min-h-[96px] flex items-center">
              {translationState === 'translating' ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Translating your clip...
                </p>
              ) : errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : (
                <p className="text-sm font-medium leading-snug">
                  {recognizedSentence || 'Record a sentence in ISL to see the translation here.'}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={copySentence} variant="outline" size="sm" className="flex-1 gap-1.5" disabled={!recognizedSentence}>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button onClick={clearResults} variant="outline" size="sm" className="flex-1 gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div className="p-4 border-b border-border space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Export</h2>
            <Button onClick={exportJSON} variant="outline" size="sm" className="w-full justify-start gap-2" disabled={!recognizedSentence}>
              <Download className="h-3.5 w-3.5" />
              JSON Session Log
            </Button>
            <Button onClick={exportText} variant="outline" size="sm" className="w-full justify-start gap-2" disabled={!recognizedSentence}>
              <FileText className="h-3.5 w-3.5" />
              Transcribed Text
            </Button>
          </div>

          <div className="p-4 mt-auto">
            <Button
              onClick={toggleRecognition}
              disabled={translationState === 'translating'}
              className={cn('w-full gap-2', isRecognizing && 'bg-destructive text-white hover:bg-destructive/90')}
            >
              {isRecognizing ? (
                <>
                  <Square className="h-4 w-4 fill-current" />
                  Stop & Translate
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Record Sentence
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* Resize Handle */}
        <div
          onMouseDown={startResize}
          className="w-1 shrink-0 cursor-col-resize border-r border-border hover:bg-primary/40 active:bg-primary/60 transition-colors"
        />

        {/* Main Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4">
          {activeTab === 'camera' ? (
            <CameraFeed isActive={isRecognizing} onClipRecorded={handleClipRecorded} />
          ) : (
            <XAIVisualizer />
          )}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <div className="border-t border-border px-4 h-9 flex items-center gap-6 text-xs text-muted-foreground shrink-0">
        <span>Resolution: <span className="text-foreground">640 × 480</span></span>
        <span>Model: <span className="text-foreground">{SPACE_ID}</span></span>
        <span>Latency: <span className="text-foreground">{latency !== null ? `${latency}ms` : '—'}</span></span>
        <span>Dataset: <span className="text-foreground">iSign</span></span>
      </div>
    </div>
  )
}
