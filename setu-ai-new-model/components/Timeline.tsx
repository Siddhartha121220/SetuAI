import React from 'react'
import { cn } from '@/lib/utils'

interface TimelineEvent {
  id: string
  word: string
  timestamp: number
  confidence: number
}

interface TimelineProps {
  events: TimelineEvent[]
  isProcessing?: boolean
}

export function Timeline({ events, isProcessing = false }: TimelineProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Recognition Timeline</h3>
        <p className="text-xs text-muted-foreground">
          {events.length} gesture{events.length !== 1 ? 's' : ''} recognized
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {events.map((event, index) => (
            <div
              key={event.id}
              className="flex flex-col items-center gap-2 min-w-max"
              style={{
                animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
              }}
            >
              {/* Connector Line */}
              {index > 0 && (
                <div className="absolute left-0 top-6 w-2 h-0.5 -ml-2 bg-gradient-to-r from-brand-accent/30 to-transparent" />
              )}

              {/* Dot */}
              <div
                className={cn(
                  'h-3 w-3 rounded-full border-2 transition-all duration-300',
                  'border-brand-accent bg-brand-accent/20',
                  event.confidence > 0.8 && 'border-brand-accent bg-brand-accent'
                )}
              />

              {/* Word Badge */}
              <div
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-center',
                  'bg-card text-card-foreground text-xs font-medium',
                  'transition-all duration-300',
                  event.confidence > 0.8
                    ? 'border-brand-accent shadow-md'
                    : 'border-border'
                )}
              >
                <div>{event.word}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(event.confidence * 100).toFixed(0)}%
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-xs text-muted-foreground">
                {event.timestamp.toFixed(1)}s
              </span>
            </div>
          ))}

          {isProcessing && (
            <div className="flex flex-col items-center gap-2 min-w-max">
              <div className="h-3 w-3 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
              <div className="text-xs text-muted-foreground">Processing...</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
