import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 text-card-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  unit?: string
  description?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

export function MetricCard({
  label,
  value,
  unit,
  description,
  icon,
  trend,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn('flex flex-col gap-2', className)} {...props}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {trend && (
        <div
          className={cn(
            'text-xs font-medium',
            trend === 'up' && 'text-brand-accent',
            trend === 'down' && 'text-red-500',
            trend === 'neutral' && 'text-muted-foreground'
          )}
        >
          {trend === 'up' && '↑ '} {trend === 'down' && '↓ '}
        </div>
      )}
    </Card>
  )
}

interface StatusPillProps extends React.HTMLAttributes<HTMLDivElement> {
  status: 'active' | 'inactive' | 'connected' | 'disconnected' | 'loading'
  label: string
}

export function StatusPill({ status, label, className, ...props }: StatusPillProps) {
  const statusColors = {
    active: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
    inactive: 'bg-muted text-muted-foreground border-border',
    connected: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
    disconnected: 'bg-destructive/10 text-destructive border-destructive/20',
    loading: 'bg-primary/10 text-primary border-primary/20',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
        statusColors[status],
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'active' && 'bg-chart-2 animate-pulse-subtle',
          status === 'connected' && 'bg-chart-2 animate-pulse-subtle',
          status === 'loading' && 'bg-primary animate-pulse-subtle',
          status === 'inactive' && 'bg-muted-foreground',
          status === 'disconnected' && 'bg-destructive'
        )}
      />
      {label}
    </div>
  )
}
