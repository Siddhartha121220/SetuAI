const SPACE_URL = 'https://siddhartha121220-isign-translator-demo.hf.space'
const RESPONSE_TIMEOUT_MS = 90_000

/**
 * Calls the isign-translator-demo Space directly over its REST/SSE API
 * (upload -> call -> stream). The published @gradio/client npm package (2.6.0)
 * doesn't speak this Space's Gradio 6 queue protocol — predict()/submit() fail
 * silently or with a generic "An error occurred" even though the Space itself
 * works fine, verified with curl against /gradio_api/upload and /gradio_api/call.
 *
 * The stream is read manually with fetch (not EventSource) because EventSource
 * can't send an Authorization header, and an hfToken raises the caller's
 * ZeroGPU quota well above the small shared anonymous quota.
 */
export async function translateSignClip(blob: Blob, hfToken?: string): Promise<string> {
  const authHeaders: HeadersInit = hfToken ? { Authorization: `Bearer ${hfToken}` } : {}

  const form = new FormData()
  form.append('files', blob, 'clip.webm')

  const uploadRes = await fetch(`${SPACE_URL}/gradio_api/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  })
  if (!uploadRes.ok) {
    throw new Error(`Upload to translation model failed (${uploadRes.status})`)
  }
  const [path] = await uploadRes.json()

  const callRes = await fetch(`${SPACE_URL}/gradio_api/call/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      data: [{ path, meta: { _type: 'gradio.FileData' }, orig_name: 'clip.webm' }],
    }),
  })
  if (!callRes.ok) {
    throw new Error(`Translation request failed (${callRes.status})`)
  }
  const { event_id } = await callRes.json()

  const streamRes = await fetch(`${SPACE_URL}/gradio_api/call/translate/${event_id}`, {
    headers: authHeaders,
  })
  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`Could not open the translation stream (${streamRes.status})`)
  }

  return readSseResult(streamRes.body)
}

function parseSseEvent(block: string): { event: string; data: string } | null {
  let event = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  return data ? { event, data } : null
}

async function readSseResult(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reader.cancel()
      reject(new Error('Translation model timed out. Please try again.'))
    }, RESPONSE_TIMEOUT_MS)
  })

  const read = (async () => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIndex
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        const parsed = parseSseEvent(block)
        if (!parsed) continue

        if (parsed.event === 'complete') {
          const data = JSON.parse(parsed.data)
          return String(data?.[0] ?? '')
        }
        if (parsed.event === 'error') {
          const data = JSON.parse(parsed.data)
          throw new Error(data?.error || 'The translation model failed to process this clip. Please try again.')
        }
        // heartbeat / other events: keep reading
      }
    }
    throw new Error('The translation stream ended unexpectedly.')
  })()

  return Promise.race([read, timeout])
}
