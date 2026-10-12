'use client'

import React from 'react'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Brain,
  Layers,
  CheckCircle2,
  Globe,
  Award,
  ArrowRight,
  Target,
  Activity,
  Heart,
  Sparkles,
} from 'lucide-react'

export default function AboutPage() {
  const sdgs = [
    {
      number: '04',
      title: 'Quality Education',
      dot: 'bg-chart-4',
      description: 'Enables inclusive classroom learning for deaf and hard-of-hearing students across India.'
    },
    {
      number: '09',
      title: 'Industry, Innovation & Infrastructure',
      dot: 'bg-chart-1',
      description: 'Advances indigenous AI infrastructure for low-resource sign language recognition.'
    },
    {
      number: '10',
      title: 'Reduced Inequalities',
      dot: 'bg-chart-2',
      description: 'Breaks communication barriers in healthcare, governance, and public services.'
    }
  ]

  const relatedProducts = [
    { name: 'Google Lookout', focus: 'Object & Scene Recognition', islSupport: 'No', fusion: 'RGB Only', sentenceLevel: 'No' },
    { name: 'SignAll', focus: 'ASL Translation via Dedicated Hardware', islSupport: 'No (ASL Only)', fusion: 'Depth + Gloves', sentenceLevel: 'Yes' },
    { name: 'iSign Dataset', focus: 'Continuous ISL Benchmark Corpus', islSupport: 'Yes (Dataset)', fusion: 'Raw RGB Annotations', sentenceLevel: 'Yes' },
    { name: 'MediaPipe Holistic', focus: 'Real-time 3D Pose, Hand & Face Mesh', islSupport: 'Landmark Primitive', fusion: 'Skeletal Tracking', sentenceLevel: 'N/A' },
    { name: 'Setu AI (Our Work)', focus: 'Multimodal Continuous ISL Recognition', islSupport: 'Yes (Native ISL)', fusion: 'RGB + MediaPipe Cross-Attention', sentenceLevel: 'Yes (Transformer)' }
  ]

  const novelties = [
    'Multimodal RGB + MediaPipe Holistic fusion',
    'Cross-Attention Transformer architecture',
    'Sentence-level continuous ISL recognition',
    'Trained on the iSign benchmark dataset',
    'Explainable AI via attention heatmaps',
    'Real-time web & edge API deployment',
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full space-y-12">

        <div className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-semibold text-foreground">Setu AI Case Study</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            An AI architecture combining high-resolution RGB visual features with MediaPipe Holistic
            skeletal landmarks via a Cross-Attention Transformer, for continuous sentence-level
            Indian Sign Language translation.
          </p>
        </div>

        {/* Introduction */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chart-1" />
            Introduction
          </h2>
          <div className="p-5 rounded-lg bg-card border border-border text-sm text-muted-foreground leading-relaxed">
            <p>
              Communication is a fundamental human right, yet millions of deaf and hard-of-hearing
              individuals in India face barriers in education, healthcare, and public services due
              to the limited availability of certified ISL interpreters.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Setu AI</strong> combines spatial RGB video with
              face, hand, and body landmarks from MediaPipe Holistic, fused via a Cross-Attention
              Transformer trained on the <strong className="text-foreground">iSign dataset</strong> to
              achieve robust sentence-level recognition across diverse signers and environments.
            </p>
          </div>
        </section>

        {/* Problem & Motivation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-card border border-border space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-chart-4" />
              Problem Statement
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Continuous ISL recognition is challenging because gestures are performed fluidly
              without inter-sign pauses, producing severe co-articulation and signer variability.
              RGB-only systems are sensitive to lighting; skeleton-only systems miss facial
              expressions and finger overlap.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-card border border-border space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 text-chart-2" />
              Motivation
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Setu AI bridges communication gaps between deaf and hearing communities by exploring
              multimodal transformer architectures that dynamically fuse RGB appearance and skeletal
              information, accessible on any web or mobile device without specialized hardware.
            </p>
          </div>
        </div>

        {/* Research Questions & Gaps */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-chart-5" />
            Research Questions & Gaps Addressed
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg bg-card border border-border space-y-2.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Research Questions</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  How to achieve effective dynamic RGB and skeletal feature fusion?
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  How to model long-term continuous temporal dependencies?
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  How to ensure robustness to signer variability and lighting?
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  How to enable XAI through attention weight visualization?
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-lg bg-card border border-border space-y-2.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gaps Addressed</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Existing literature heavily focuses on ASL, with limited work on continuous
                sentence-level ISL. Multimodal transformer fusion remains underexplored.
              </p>
              <div className="p-3 rounded-md bg-secondary border border-border text-xs text-foreground">
                <strong>Setu AI Solution:</strong> A multimodal cross-attention transformer that
                jointly processes RGB frames and MediaPipe landmarks to improve accuracy and
                transparency.
              </div>
            </div>
          </div>
        </section>

        {/* Related Products */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-chart-1" />
            Related Products & Comparative Analysis
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground font-medium uppercase tracking-wide border-b border-border">
                <tr>
                  <th className="px-4 py-3">Product / Framework</th>
                  <th className="px-4 py-3">Focus Area</th>
                  <th className="px-4 py-3">ISL Support</th>
                  <th className="px-4 py-3">Modality Fusion</th>
                  <th className="px-4 py-3">Sentence Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {relatedProducts.map((p, idx) => (
                  <tr key={idx} className={p.name.includes('Setu AI') ? 'bg-primary/5' : ''}>
                    <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                      {p.name.includes('Setu AI') && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.focus}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.islSupport}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.fusion}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sentenceLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SDG Mapping */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-chart-2" />
            UN Sustainable Development Goals Alignment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sdgs.map((sdg, idx) => (
              <div key={idx} className="p-5 rounded-lg bg-card border border-border flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${sdg.dot}`} />
                    <span className="text-xs font-mono text-muted-foreground">SDG {sdg.number}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{sdg.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{sdg.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dataset & Novelty */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-card border border-border space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-chart-3" />
              Dataset (iSign Benchmark)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A large-scale continuous ISL benchmark dataset with thousands of annotated
              sentence-level videos recorded from diverse signers across India.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-card border border-border space-y-2.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-chart-5" />
              Key Novelties
            </h3>
            <div className="space-y-1.5">
              {novelties.map((n, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-secondary text-[10px] font-mono text-foreground shrink-0">
                    {i + 1}
                  </span>
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-lg bg-card border border-border text-center space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Ready to experience Setu AI?</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Launch the translation workspace to see real-time continuous ISL recognition in action.
          </p>
          <Link href="/translate">
            <Button size="lg" className="gap-2">
              Open Translation Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

      </main>
    </div>
  )
}
