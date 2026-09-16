'use client'

import React from 'react'
import { Card } from '@/components/Card'
import { Brain, Layers, Activity, Eye, Zap } from 'lucide-react'

interface XAIWeights {
  rgb_modality_weight?: number
  skeleton_modality_weight?: number
  top_attended_joints?: Array<{ name: string; weight: number; category: string }>
  attention_matrix?: number[][]
  layer_attentions?: Array<{ layer: string; score: number }>
}

interface XAIVisualizerProps {
  weights?: XAIWeights
}

export function XAIVisualizer({ weights }: XAIVisualizerProps) {
  const rgbWeight = weights?.rgb_modality_weight ?? 0.46
  const skeletonWeight = weights?.skeleton_modality_weight ?? 0.54
  const topJoints = weights?.top_attended_joints ?? [
    { name: 'Right Wrist & Index Tip', weight: 0.38, category: 'Hand' },
    { name: 'Left Thumb & Palm', weight: 0.29, category: 'Hand' },
    { name: 'Mouth Outer Contour', weight: 0.18, category: 'Face' },
    { name: 'Shoulder & Elbow Vector', weight: 0.15, category: 'Pose' }
  ]

  const layers = weights?.layer_attentions ?? [
    { layer: 'Cross-Attention Head 1 (RGB-Spatial)', score: 0.94 },
    { layer: 'Cross-Attention Head 2 (Keypoint Temporal)', score: 0.91 },
    { layer: 'Transformer Encoder Layer 4', score: 0.88 },
    { layer: 'Decoupled Sentence Decoder', score: 0.96 }
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-secondary text-primary">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Explainable AI Matrix</h3>
            <p className="text-xs text-muted-foreground">Cross-attention fusion heatmaps & node importance</p>
          </div>
        </div>
        <div className="px-2.5 h-6 rounded-md text-xs font-medium bg-secondary text-muted-foreground border border-border flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          Live
        </div>
      </div>

      {/* Modality Fusion Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg bg-card border border-border space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>RGB Visual Stream</span>
            <span className="text-chart-1 font-mono">{(rgbWeight * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-1 rounded-full transition-all duration-700"
              style={{ width: `${rgbWeight * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Captures illumination features, texture contours, and fine-grained visual context.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>MediaPipe Skeletal Stream</span>
            <span className="text-chart-2 font-mono">{(skeletonWeight * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-2 rounded-full transition-all duration-700"
              style={{ width: `${skeletonWeight * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tracks 3D joint spatial vectors, hand geometry (42 nodes), and facial movement mesh (468 nodes).
          </p>
        </div>
      </div>

      {/* Spatial Joint Attention Ranking */}
      <div className="p-4 rounded-lg bg-card border border-border space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          Top Attended Joints & Keypoint Regions
        </h4>

        <div className="space-y-2">
          {topJoints.map((joint, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-md bg-secondary border border-border">
              <div className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-background text-[11px] font-mono font-medium text-muted-foreground">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground">{joint.name}</p>
                  <p className="text-[10px] text-muted-foreground">{joint.category} Landmark Group</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${joint.weight * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-9 text-right">
                  {(joint.weight * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Layer-wise Attention Scores */}
      <div className="p-4 rounded-lg bg-card border border-border space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" />
          Cross-Attention Transformer Layer Breakdown
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {layers.map((layer, i) => (
            <div key={i} className="p-3 rounded-md bg-secondary border border-border flex flex-col justify-between">
              <span className="text-xs font-medium text-foreground">{layer.layer}</span>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[11px]">
                <span className="text-muted-foreground">Attention Coherence</span>
                <span className="font-mono text-primary">{(layer.score * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
