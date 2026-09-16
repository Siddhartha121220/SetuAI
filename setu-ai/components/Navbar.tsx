'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { HFConfigModal } from '@/components/HFConfigModal'
import { Waypoints, Brain, BookOpen, Home, Video, Settings2 } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()
  const [isHFModalOpen, setIsHFModalOpen] = useState(false)

  const navLinks = [
    { name: 'Home', href: '/', icon: <Home className="h-4 w-4" /> },
    { name: 'Translate', href: '/translate', icon: <Video className="h-4 w-4" /> },
    { name: 'History', href: '/history', icon: <BookOpen className="h-4 w-4" /> },
    { name: 'XAI', href: '/xai', icon: <Brain className="h-4 w-4" /> },
    { name: 'About', href: '/about', icon: <BookOpen className="h-4 w-4" /> },
  ]

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waypoints className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">Setu AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 h-8 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              )
            })}
          </div>

          <Button
            onClick={() => setIsHFModalOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Model Config
          </Button>
        </div>
      </nav>

      <HFConfigModal
        isOpen={isHFModalOpen}
        onClose={() => setIsHFModalOpen(false)}
      />
    </>
  )
}
