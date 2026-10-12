'use client'

import React, { useState, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { XAIVisualizer } from '@/components/XAIVisualizer'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function XAIPage() {
  const [xaiData, setXaiData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchXAIData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/xai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keypoints_sequence: [] })
      })
      if (res.ok) {
        const data = await res.json()
        setXaiData(data.xai_weights)
      }
    } catch (e) {
      console.warn('Backend unavailable, using default transformer weights visualizer.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchXAIData()
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cross-Attention Visualizer</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              Multi-head spatial joint attention, RGB vs. skeletal modality weighting, and temporal decoding.
            </p>
          </div>

          <Button onClick={fetchXAIData} disabled={isLoading} variant="outline" className="gap-2 shrink-0">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <XAIVisualizer weights={xaiData} />
      </main>
    </div>
  )
}
