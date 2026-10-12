'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, X, Sparkles } from 'lucide-react'
import { getHfToken, setHfToken } from '@/lib/hfToken'

interface HFConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HFConfigModal({ isOpen, onClose }: HFConfigModalProps) {
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setToken(getHfToken())
      setSaved(false)
    }
  }, [isOpen])

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    setHfToken(token.trim())
    setSaved(true)
    setTimeout(() => onClose(), 900)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-lg rounded-lg bg-card border border-border p-6 text-foreground">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-md bg-secondary text-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Hugging Face Token</h2>
            <p className="text-xs text-muted-foreground">Raises your ZeroGPU quota on the translation model</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Access Token (optional)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              The translation Space runs on Hugging Face ZeroGPU, which gives anonymous callers a
              small shared quota. Signing requests with your own token (free at{' '}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                hf.co/settings/tokens
              </a>
              , read access is enough) gives you your own, much larger quota. Stored only in this
              browser — never sent anywhere but the translation Space.
            </p>
          </div>

          {saved && (
            <div className="p-2.5 rounded-md flex items-center gap-2 text-xs font-medium border bg-chart-2/10 text-chart-2 border-chart-2/20">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Saved.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="px-5">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
