import api from './index'

export const chat = {
  send: (messages, personality = 'tsundere') =>
    api.post('/ai/chat', { messages, personality }),

  sendStream: async (messages, personality = 'tsundere', onChunk, signal) => {
    const token = localStorage.getItem('token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, personality }),
      signal
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
  }
}
