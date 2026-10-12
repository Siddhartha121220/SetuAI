const STORAGE_KEY = 'setu_ai_hf_token'

export function getHfToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setHfToken(token: string) {
  if (typeof window === 'undefined') return
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable (private browsing, etc.) — token just won't persist
  }
}
