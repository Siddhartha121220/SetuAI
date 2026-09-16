import React from 'react'
import { Card } from './Card'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  highlighted?: boolean
  className?: string
}

export function FeatureCard({
  icon,
  title,
  description,
  highlighted = false,
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-4',
        highlighted &&
          'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20',
        className
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          highlighted
            ? 'bg-brand-primary/20 text-brand-primary'
            : 'bg-brand-accent/20 text-brand-accent'
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  )
}
