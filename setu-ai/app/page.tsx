'use client'

import React from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Layers,
  Video,
  Brain,
  Sparkles,
  BookOpen,
} from 'lucide-react'

export default function Home() {
  const features = [
    {
      icon: <Layers className="h-4.5 w-4.5" />,
      dot: 'bg-chart-1',
      title: 'Multimodal Fusion',
      description: 'Combines RGB appearance with MediaPipe Holistic keypoints via cross-attention.'
    },
    {
      icon: <Video className="h-4.5 w-4.5" />,
      dot: 'bg-chart-2',
      title: 'Continuous Recognition',
      description: 'Translates continuous ISL sentences without inter-sign pauses or segmentation.'
    },
    {
      icon: <Sparkles className="h-4.5 w-4.5" />,
      dot: 'bg-chart-3',
      title: 'HF Endpoint Ready',
      description: 'Interfaces directly with custom PyTorch models deployed on Hugging Face.'
    },
    {
      icon: <Brain className="h-4.5 w-4.5" />,
      dot: 'bg-chart-5',
      title: 'Explainable AI',
      description: 'Real-time cross-attention heatmaps highlighting the joints driving each translation.'
    }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-border px-6 py-20 flex flex-col items-center text-center gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium bg-secondary text-muted-foreground border border-border">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Continuous Indian Sign Language Recognition
        </div>

        <h1 className="text-5xl font-semibold tracking-tight text-foreground max-w-2xl">
          Setu AI
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Fusing RGB video with 3D MediaPipe Holistic skeletal landmarks via a Cross-Attention
          Transformer, trained on the iSign benchmark dataset.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <Link href="/translate">
            <Button size="lg" className="gap-2 px-5">
              Launch Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/about">
            <Button size="lg" variant="outline" className="gap-2 px-5">
              <BookOpen className="h-4 w-4" />
              Case Study
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-6 py-14 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="p-5 rounded-lg bg-card border border-border flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${f.dot}`} />
                <span className="text-muted-foreground">{f.icon}</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Summary Banner */}
      <section className="px-6 pb-14 max-w-6xl mx-auto w-full">
        <div className="p-8 rounded-lg bg-card border border-border grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-2">
            <span className="text-xs font-medium text-muted-foreground">iSign Benchmark Dataset</span>
            <h3 className="text-xl font-semibold text-foreground">Trained for real-world ISL variability</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Addressing co-articulation, temporal dependencies, multi-signer normalization, and
              environmental robustness across continuous Indian Sign Language sentences.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/xai">
              <Button variant="outline" className="w-full justify-center">
                Explore XAI Visualizer
              </Button>
            </Link>
            <Link href="/translate">
              <Button className="w-full justify-center">
                Start Translation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2026 Setu AI</p>
          <div className="flex items-center gap-5">
            <Link href="/translate" className="hover:text-foreground">Workspace</Link>
            <Link href="/xai" className="hover:text-foreground">XAI Visualizer</Link>
            <Link href="/about" className="hover:text-foreground">Case Study</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
