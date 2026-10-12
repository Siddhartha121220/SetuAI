'use client'

import React, { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Camera, ShieldCheck } from 'lucide-react'

interface CameraFeedProps {
  isActive?: boolean
  className?: string
  onClipRecorded?: (blob: Blob) => void
}

export function CameraFeed({
  isActive = false,
  className,
  onClipRecorded,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamStarted, setStreamStarted] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Start webcam feed + clip recording when active
  useEffect(() => {
    let mediaStream: MediaStream | null = null
    let cancelled = false

    async function initCamera() {
      if (isActive) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
          })
          if (cancelled) {
            mediaStream.getTracks().forEach((track) => track.stop())
            return
          }
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
            videoRef.current.play()
            setStreamStarted(true)
            setCameraError(null)
          }

          chunksRef.current = []
          const recorder = new MediaRecorder(mediaStream)
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
          }
          recorder.start()
          recorderRef.current = recorder
        } catch (err: any) {
          console.warn('Webcam permission denied or unavailable:', err)
          setCameraError('Webcam unavailable. Check camera permissions and try again.')
          setStreamStarted(false)
        }
      }
    }

    function stopCamera() {
      const recorder = recorderRef.current
      const stream = mediaStream
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
          stream?.getTracks().forEach((track) => track.stop())
          onClipRecorded?.(blob)
        }
        recorder.stop()
      } else {
        stream?.getTracks().forEach((track) => track.stop())
      }
      recorderRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setStreamStarted(false)
    }

    initCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [isActive])

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg border border-border bg-card',
        'aspect-video',
        className
      )}
    >
      {/* Video Element (mirrored for a natural selfie view) */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }}
        className={cn(
          'absolute inset-0 h-full w-full object-cover',
          streamStarted ? 'opacity-90' : 'opacity-0'
        )}
      />

      {/* Fallback / Inactive State */}
      {(!isActive || !streamStarted) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card p-6 text-center z-0">
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <div
              className={cn(
                'rounded-lg p-3.5 border transition-all duration-300',
                isActive
                  ? 'bg-primary/10 border-primary/30 text-primary animate-pulse'
                  : 'bg-secondary border-border text-muted-foreground'
              )}
            >
              <Camera className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                {isActive ? 'Recording Your Sentence' : 'Camera Feed Ready'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {isActive
                  ? 'Sign your sentence, then press Stop & Translate to send the clip for translation.'
                  : 'Click "Record Sentence" to start signing.'}
              </p>
            </div>
            {cameraError && (
              <div className="px-3 py-1.5 rounded-md bg-chart-3/10 border border-chart-3/20 text-[11px] text-chart-3 font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {cameraError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Badge */}
      {isActive && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1 border border-border">
          <div className="h-1.5 w-1.5 rounded-full bg-chart-2 animate-pulse-subtle" />
          <span className="text-[11px] font-medium tracking-wide text-foreground">Live</span>
        </div>
      )}
    </div>
  )
}
