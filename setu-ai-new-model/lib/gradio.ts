const BACKEND_URL = process.env.NEXT_PUBLIC_ISL_BACKEND_URL || 'http://localhost:8001'

export interface TranslationCandidate {
  sentence: string
  score: number
}

export interface TranslationResult {
  translation: string
  raw_output: string
  confidence: number
  low_confidence: boolean
  candidates: TranslationCandidate[]
  pose_detection_rate: number
  model: string
  timings_s: Record<string, number>
}

/**
 * Sends a recorded/uploaded clip to the local ISL-CSLTR backend
 * (backend-new-model/, see ISL_Integration_Brief.md) for translation.
 * Unlike the old iSign v7 Space, this model only recognizes a fixed
 * 101-sentence bank, so the response always includes a confidence and
 * top-k candidates instead of free-form text.
 */
export async function translateSignClip(blob: Blob): Promise<TranslationResult> {
  const form = new FormData()
  form.append('file', blob, 'clip.webm')

  const res = await fetch(`${BACKEND_URL}/api/translate`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail || `Translation request failed (${res.status})`)
  }

  return res.json()
}
