'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
}

export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border bg-muted/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all duration-200 text-sm',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="py-6">{activeTabContent}</div>
    </div>
  )
}
