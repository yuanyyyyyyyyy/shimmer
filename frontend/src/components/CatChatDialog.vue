<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { chat } from '../api/chat.js'

const emit = defineEmits(['close'])

const PERSONALITIES = [
  { id: 'tsundere', label: '傲娇', color: '#c4a882', greeting: '哼！又是你……想跟本喵聊什么？' },
  { id: 'healing', label: '治愈', color: '#d4a0a0', greeting: '你来找我啦~ 今天过得好吗？' },
  { id: 'playful', label: '话痨', color: '#b5c4b1', greeting: '呀！你终于来啦！我跟你说我今天……' },
  { id: 'assistant', label: '助手', color: '#96aec4', greeting: '你好，我是小影。需要我帮忙整理照片或回忆吗？' }
]

const personality = ref(localStorage.getItem('catPersonality') || 'tsundere')
const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const streaming = ref(false)
const messagesRef = ref(null)
const inputRef = ref(null)
const showPersonalityMenu = ref(false)
let abortController = null
let saveTimer = null

const activeConvId = ref(null)
const conversations = ref([])
const showHistory = ref(false)
const historyLoading = ref(false)

const currentPersona = computed(() => PERSONALITIES.find(p => p.id === personality.value))

const PERSONALITY_MAP = Object.fromEntries(PERSONALITIES.map(p => [p.id, p]))

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `今天 ${time}`
  if (isYesterday) return `昨天 ${time}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}

function genTitle(msgs) {
  const firstUser = msgs.find(m => m.role === 'user')
  if (!firstUser) return '新对话'
  return firstUser.content.slice(0, 20) + (firstUser.content.length > 20 ? '...' : '')
}

const setPersonality = (id) => {
  if (id === personality.value) {
    showPersonalityMenu.value = false
    return
  }
  personality.value = id
  localStorage.setItem('catPersonality', id)
  showPersonalityMenu.value = false

  const allGreetings = PERSONALITIES.map(p => p.greeting)
  const firstMsg = messages.value[0]
  if (firstMsg && firstMsg.role === 'assistant' && allGreetings.includes(firstMsg.content)) {
    const newGreeting = currentPersona.value?.greeting || '喵~'
    messages.value[0] = { ...firstMsg, content: newGreeting }
  }

  if (activeConvId.value) {
    chat.updateHistory(activeConvId.value, { personality: id }).catch(() => {})
  }
}

const send = async () => {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  inputText.value = ''
  messages.value.push({ role: 'user', content: text })
  loading.value = true
  streaming.value = false
  scrollToBottom()

  try {
    const chatMessages = messages.value.map(m => ({
      role: m.role,
      content: m.content
    }))

    abortController = new AbortController()
    let replyIndex = -1
    let firstChunk = true

    await chat.sendStream(
      chatMessages,
      personality.value,
      (chunk) => {
        if (firstChunk) {
          firstChunk = false
          replyIndex = messages.value.length
          messages.value.push({ role: 'assistant', content: chunk })
          loading.value = false
          streaming.value = true
        } else {
          messages.value[replyIndex] = {
            ...messages.value[replyIndex],
            content: messages.value[replyIndex].content + chunk
          }
        }
        scrollToBottom()
      }
    )

    if (firstChunk) {
      messages.value.push({ role: 'assistant', content: '喵……' })
    }
  } catch (err) {
    if (err.name === 'AbortError') return
    messages.value.push({
      role: 'assistant',
      content: '喵…网络好像出了点问题，等我缓一缓再聊好不好？'
    })
  } finally {
    loading.value = false
    streaming.value = false
    abortController = null
    scrollToBottom()
    debounceSave()
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function debounceSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveCurrentConversation()
  }, 1000)
}

async function saveCurrentConversation() {
  if (messages.value.length === 0) return

  const title = genTitle(messages.value)
  const payload = {
    title,
    personality: personality.value,
    messages: messages.value
  }

  try {
    if (activeConvId.value) {
      await chat.updateHistory(activeConvId.value, payload)
    } else {
      const res = await chat.saveHistory(payload)
      if (res.id) activeConvId.value = res.id
    }
  } catch {}
}

const startNewChat = async () => {
  await saveCurrentConversation()
  activeConvId.value = null
  messages.value = []
  const greeting = currentPersona.value?.greeting || '喵~'
  messages.value.push({ role: 'assistant', content: greeting })
}

const loadConversation = async (conv) => {
  await saveCurrentConversation()
  activeConvId.value = conv.id
  showHistory.value = false

  try {
    const res = await chat.getHistory(conv.id)
    if (res.conversation) {
      messages.value = res.conversation.messages || []
      if (res.conversation.personality) {
        personality.value = res.conversation.personality
        localStorage.setItem('catPersonality', res.conversation.personality)
      }
    }
  } catch {
    messages.value = [{ role: 'assistant', content: '喵……加载对话失败了' }]
  }
}

const deleteConversation = async (conv, e) => {
  e.stopPropagation()
  try {
    await chat.deleteHistory(conv.id)
    conversations.value = conversations.value.filter(c => c.id !== conv.id)
    if (activeConvId.value === conv.id) {
      activeConvId.value = null
      messages.value = []
      const greeting = currentPersona.value?.greeting || '喵~'
      messages.value.push({ role: 'assistant', content: greeting })
    }
  } catch {}
}

const loadHistory = async () => {
  showHistory.value = !showHistory.value
  if (!showHistory.value) return

  historyLoading.value = true
  try {
    const res = await chat.listHistory()
    conversations.value = res.conversations || []
  } catch {
    conversations.value = []
  } finally {
    historyLoading.value = false
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    if (showPersonalityMenu.value) {
      showPersonalityMenu.value = false
    } else if (showHistory.value) {
      showHistory.value = false
    } else {
      emit('close')
    }
  }
}

onMounted(() => {
  const greeting = currentPersona.value?.greeting || '喵~'
  messages.value.push({ role: 'assistant', content: greeting })
  nextTick(() => inputRef.value?.focus())
})

onBeforeUnmount(() => {
  if (abortController) abortController.abort()
  if (saveTimer) clearTimeout(saveTimer)
  saveCurrentConversation()
})
</script>

<template>
  <div
    class="chat-dialog"
    @click.stop
    @keydown="handleKeydown"
    role="dialog"
    aria-label="猫咪聊天"
  >
    <div class="chat-header">
      <div class="cat-info">
        <img src="/cat.png" alt="小猫" class="cat-avatar-img" />
        <span class="cat-name">
          小猫
          <span class="persona-tag" :style="{ background: currentPersona?.color }">{{ currentPersona?.label }}</span>
        </span>
      </div>

      <div class="header-actions">
        <div class="personality-wrapper">
          <button
            class="header-btn personality-btn"
            @click="showPersonalityMenu = !showPersonalityMenu"
            title="切换性格"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
          <Transition name="menu">
            <div v-if="showPersonalityMenu" class="personality-menu">
              <button
                v-for="p in PERSONALITIES"
                :key="p.id"
                class="personality-option"
                :class="{ active: personality === p.id }"
                @click="setPersonality(p.id)"
              >
                <span class="personality-dot" :style="{ background: p.color }"></span>
                <span class="personality-label">{{ p.label }}</span>
              </button>
            </div>
          </Transition>
        </div>

        <button class="header-btn history-btn" @click="loadHistory" title="历史对话">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>

        <button class="header-btn new-btn" @click="startNewChat" title="新对话">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        <button class="header-btn close-btn" @click="emit('close')" title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div ref="messagesRef" class="chat-messages">
      <div v-for="(msg, i) in messages" :key="i" :class="['msg-row', msg.role]">
        <div v-if="msg.role === 'assistant'" class="msg-avatar">
          <img src="/cat.png" alt="小猫" class="mini-avatar-img" />
        </div>
        <div :class="['msg-bubble', { streaming: streaming && i === messages.length - 1 && msg.role === 'assistant' }]">
          {{ msg.content }}
        </div>
      </div>

      <div v-if="loading" class="msg-row assistant">
        <div class="msg-avatar">
          <img src="/cat.png" alt="小猫" class="mini-avatar-img" />
        </div>
        <div class="msg-bubble typing">
          <span class="typing-dot">·</span>
          <span class="typing-dot">·</span>
          <span class="typing-dot">·</span>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <input
        ref="inputRef"
        v-model="inputText"
        type="text"
        class="chat-input"
        placeholder="对小猫说点什么..."
        @keyup.enter="send"
        :disabled="loading"
      />
      <button
        class="send-btn"
        :class="{ active: inputText.trim() }"
        :disabled="!inputText.trim() || loading"
        @click="send"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>

    <Transition name="drawer">
      <div v-if="showHistory" class="history-drawer">
        <div class="history-header">
          <span class="history-title">历史对话</span>
          <button class="history-close" @click="showHistory = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="history-list">
          <div v-if="historyLoading" class="history-empty">加载中...</div>
          <div v-else-if="conversations.length === 0" class="history-empty">暂无历史对话</div>
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="history-item"
            :class="{ active: activeConvId === conv.id }"
            @click="loadConversation(conv)"
          >
            <div class="history-item-main">
              <div class="history-item-title">{{ conv.title }}</div>
              <div class="history-item-meta">
                <span class="history-item-personality" :style="{ background: PERSONALITY_MAP[conv.personality]?.color || '#999' }">
                  {{ PERSONALITY_MAP[conv.personality]?.label || conv.personality }}
                </span>
                <span class="history-item-time">{{ formatDate(conv.updated_at) }}</span>
              </div>
            </div>
            <button class="history-item-delete" @click="deleteConversation(conv, $event)" title="删除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.chat-dialog {
  width: 360px;
  max-height: min(520px, calc(100vh - 100px));
  background: var(--card-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid var(--n-300, #e0e0e0);
  transition: background 0.3s, border-color 0.3s;
  position: relative;
}

:root.dark .chat-dialog {
  border-color: #3a3a3a;
}

/* ===== HEADER ===== */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--n-200, #eee);
  flex-shrink: 0;
}

:root.dark .chat-header {
  border-color: #333;
}

.cat-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cat-avatar-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 50%;
}

.cat-name {
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.persona-tag {
  display: inline-block;
  font-size: 0.6rem;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  font-weight: 500;
  letter-spacing: 0.03em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.header-btn:hover {
  background: var(--hover-bg, rgba(0,0,0,0.05));
  color: var(--text-color, #333);
}

:root.dark .header-btn:hover {
  background: rgba(255,255,255,0.1);
}

.personality-wrapper {
  position: relative;
}

.personality-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--card-bg, #fff);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  padding: 6px;
  min-width: 120px;
  z-index: 10;
  border: 1px solid var(--n-300, #e0e0e0);
}

:root.dark .personality-menu {
  border-color: #3a3a3a;
  background: #2d2d2d;
}

.personality-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  color: var(--text-color, #333);
  font-size: 0.82rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.personality-option:hover {
  background: var(--hover-bg, rgba(0,0,0,0.05));
}

.personality-option.active {
  font-weight: 600;
}

.personality-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ===== MESSAGES ===== */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

.msg-row {
  display: flex;
  gap: 8px;
  max-width: 88%;
  animation: msg-in 0.25s ease-out;
}

.msg-row.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

@keyframes msg-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.msg-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
}

.mini-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}

.msg-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 0.85rem;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}

.msg-row.assistant .msg-bubble {
  background: var(--n-200, #f0f0f0);
  color: var(--text-color, #333);
  border-bottom-left-radius: 4px;
}

.msg-row.user .msg-bubble {
  background: #2c3e50;
  color: #fff;
  border-bottom-right-radius: 4px;
}

:root.dark .msg-row.assistant .msg-bubble {
  background: #333;
  color: #e0e0e0;
}

:root.dark .msg-row.user .msg-bubble {
  background: #1a3a5c;
  color: #e0e0e0;
}

.msg-bubble.typing {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 14px 18px;
}

.typing-dot {
  display: inline-block;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--text-tertiary, #999);
  animation: typing-bounce 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.msg-bubble.streaming::after {
  content: '|';
  display: inline-block;
  color: var(--text-color, #333);
  font-weight: 300;
  margin-left: 2px;
  animation: cursor-blink 0.8s step-end infinite;
  vertical-align: baseline;
}

:root.dark .msg-bubble.streaming::after {
  color: #e0e0e0;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* ===== INPUT ===== */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--n-200, #eee);
  flex-shrink: 0;
}

:root.dark .chat-input-area {
  border-color: #333;
}

.chat-input {
  flex: 1;
  border: 1px solid var(--n-300, #e0e0e0);
  background: var(--n-200, #f5f5f5);
  color: var(--text-color, #333);
  border-radius: 20px;
  padding: 9px 16px;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s, background 0.3s, color 0.3s;
}

.chat-input:focus {
  border-color: #2c3e50;
}

:root.dark .chat-input {
  background: #333;
  border-color: #444;
  color: #e0e0e0;
}

:root.dark .chat-input:focus {
  border-color: #64b5f6;
}

.chat-input::placeholder {
  color: var(--text-tertiary, #999);
}

.chat-input:disabled {
  opacity: 0.6;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--n-300, #e0e0e0);
  color: var(--text-tertiary, #999);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn.active {
  background: #2c3e50;
  color: #fff;
}

.send-btn.active:hover {
  opacity: 0.9;
}

.send-btn:disabled {
  cursor: not-allowed;
}

.send-btn:not(.active):hover {
  background: var(--n-300, #ddd);
}

:root.dark .send-btn {
  background: #444;
}

:root.dark .send-btn.active {
  background: #64b5f6;
}

/* ===== HISTORY DRAWER ===== */
.history-drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: var(--card-bg, #fff);
  border-left: 1px solid var(--n-200, #eee);
  display: flex;
  flex-direction: column;
  z-index: 5;
}

:root.dark .history-drawer {
  background: #252525;
  border-color: #333;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--n-200, #eee);
  flex-shrink: 0;
}

:root.dark .history-header {
  border-color: #333;
}

.history-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-color, #333);
}

.history-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #999);
  cursor: pointer;
}

.history-close:hover {
  background: var(--hover-bg, rgba(0,0,0,0.05));
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-empty {
  text-align: center;
  color: var(--text-tertiary, #999);
  font-size: 0.8rem;
  padding: 32px 16px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.history-item:hover {
  background: var(--hover-bg, rgba(0,0,0,0.05));
}

.history-item.active {
  background: var(--n-200, #f0f0f0);
}

:root.dark .history-item.active {
  background: #333;
}

.history-item-main {
  flex: 1;
  min-width: 0;
}

.history-item-title {
  font-size: 0.82rem;
  color: var(--text-color, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.history-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.history-item-personality {
  display: inline-block;
  font-size: 0.55rem;
  padding: 1px 5px;
  border-radius: 3px;
  color: #fff;
  font-weight: 500;
}

.history-item-time {
  font-size: 0.65rem;
  color: var(--text-tertiary, #999);
}

.history-item-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  flex-shrink: 0;
}

.history-item:hover .history-item-delete {
  opacity: 1;
}

.history-item-delete:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

/* ===== MENU TRANSITION ===== */
.menu-enter-active {
  animation: menu-in 0.15s ease-out;
}

.menu-leave-active {
  animation: menu-in 0.12s ease-in reverse;
}

@keyframes menu-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== DRAWER TRANSITION ===== */
.drawer-enter-active {
  animation: drawer-in 0.25s ease-out;
}

.drawer-leave-active {
  animation: drawer-in 0.2s ease-in reverse;
}

@keyframes drawer-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* ===== SCROLLBAR ===== */
.chat-messages::-webkit-scrollbar,
.history-list::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track,
.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb,
.history-list::-webkit-scrollbar-thumb {
  background: var(--n-300, #ddd);
  border-radius: 2px;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 700px) {
  .chat-dialog {
    width: calc(100vw - 32px);
    max-height: 60vh;
    position: fixed;
    bottom: 76px;
    right: 16px;
  }
  .history-drawer {
    width: 240px;
  }
}
</style>
