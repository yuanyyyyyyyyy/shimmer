import api from './index'

function getFingerprint() {
  let fp = localStorage.getItem('catFingerprint')
  if (!fp) {
    fp = 'fp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('catFingerprint', fp)
  }
  return fp
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('token') || sessionStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  else headers['X-Fingerprint'] = getFingerprint()
  return headers
}

export const chat = {
  send: (messages, personality = 'tsundere') =>
    api.post('/ai/chat', { messages, personality }),

  sendStream: async (messages, personality = 'tsundere', onChunk) => {
    const headers = getHeaders()

    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, personality })
    })

    if (!response.ok) {
      throw new Error(`AI 请求失败: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') return ''
          try {
            const parsed = JSON.parse(data)
            if (parsed.done) return parsed.content || ''
            if (parsed.content) onChunk(parsed.content)
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    }

    return ''
  },

  listHistory: () =>
    fetch('/api/ai/chat/history', { headers: getHeaders() }).then(r => r.json()),

  getHistory: (id) =>
    fetch(`/api/ai/chat/history/${id}`, { headers: getHeaders() }).then(r => r.json()),

  saveHistory: (data) =>
    fetch('/api/ai/chat/history', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  updateHistory: (id, data) =>
    fetch(`/api/ai/chat/history/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  deleteHistory: (id) =>
    fetch(`/api/ai/chat/history/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    }).then(r => r.json()),

  clearHistory: () =>
    fetch('/api/ai/chat/history', {
      method: 'DELETE',
      headers: getHeaders()
    }).then(r => r.json())
}
