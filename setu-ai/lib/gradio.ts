const SPACE_URL = 'https://siddhartha121220-isign-translator-demo.hf.space'
const RESPONSE_TIMEOUT_MS = 90_000

/**
 * Calls the isign-translator-demo Space directly over its REST/SSE API
 * (upload -> call -> stream). The published @gradio/client npm package (2.6.0)
 * doesn't speak this Space's Gradio 6 queue protocol — predict()/submit() fail
 * silently or with a generic "An error occurred" even though the Space itself
 * works fine, verified with curl against /gradio_api/upload and /gradio_api/call.
 */
export async function translateSignClip(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('files', blob, 'clip.webm')

  const uploadRes = await fetch(`${SPACE_URL}/gradio_api/upload`, {
    method: 'POST',
    body: form,
  })
  if (!uploadRes.ok) {
    throw new Error(`Upload to translation model failed (${uploadRes.status})`)
  }
  const [path] = await uploadRes.json()

  const callRes = await fetch(`${SPACE_URL}/gradio_api/call/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{ path, meta: { _type: 'gradio.FileData' }, orig_name: 'clip.webm' }],
    }),
  })
  if (!callRes.ok) {
    throw new Error(`Translation request failed (${callRes.status})`)
  }
  const { event_id } = await callRes.json()

  return new Promise((resolve, reject) => {
    const es = new EventSource(`${SPACE_URL}/gradio_api/call/translate/${event_id}`)

    const timeout = setTimeout(() => {
      es.close()
      reject(new Error('Translation model timed out. Please try again.'))
    }, RESPONSE_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(timeout)
      es.close()
    }

    es.addEventListener('complete', (e: MessageEvent) => {
      cleanup()
      try {
        const data = JSON.parse(e.data)
        resolve(String(data?.[0] ?? ''))
      } catch {
        reject(new Error('Could not parse the translation response.'))
      }
    })

    es.addEventListener('error', (e: MessageEvent) => {
      cleanup()
      let message = 'The translation model failed to process this clip. Please try again.'
      try {
        const parsed = e.data ? JSON.parse(e.data) : null
        if (parsed?.error) message = parsed.error
      } catch {
        // fall through to the generic message
      }
      reject(new Error(message))
    })
  })
}
