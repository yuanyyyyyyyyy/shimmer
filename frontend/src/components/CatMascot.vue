<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import CatChatDialog from './CatChatDialog.vue'

const isOpen = ref(false)
const showTooltip = ref(false)
const isHovered = ref(false)
const isDark = ref(false)

const DRAG_THRESHOLD = 5

const pos = reactive({
  x: parseInt(localStorage.getItem('catMascotX') || '24', 10),
  y: parseInt(localStorage.getItem('catMascotY') || '24', 10)
})

const drag = reactive({
  active: false,
  startX: 0,
  startY: 0,
  startPosX: 0,
  startPosY: 0,
  hasMoved: false
})

const checkDarkMode = () => {
  isDark.value = document.documentElement.classList.contains('dark')
}

const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) showTooltip.value = false
}

const closeChat = () => { isOpen.value = false }

const onPointerDown = (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  drag.active = true
  drag.hasMoved = false
  drag.startX = e.clientX
  drag.startY = e.clientY
  drag.startPosX = pos.x
  drag.startPosY = pos.y
  e.currentTarget.setPointerCapture(e.pointerId)
}

const onPointerMove = (e) => {
  if (!drag.active) return
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    drag.hasMoved = true
  }
  if (drag.hasMoved) {
    pos.x = Math.max(0, Math.min(window.innerWidth - 80, drag.startPosX - dx))
    pos.y = Math.max(0, Math.min(window.innerHeight - 96, drag.startPosY - dy))
  }
}

const onPointerUp = (e) => {
  if (!drag.active) return
  drag.active = false
  e.currentTarget.releasePointerCapture(e.pointerId)
  if (drag.hasMoved) {
    localStorage.setItem('catMascotX', String(pos.x))
    localStorage.setItem('catMascotY', String(pos.y))
  } else {
    toggleChat()
  }
}

let darkObserver = null
let tooltipTimer1 = null
let tooltipTimer2 = null

onMounted(() => {
  checkDarkMode()
  darkObserver = new MutationObserver(checkDarkMode)
  darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  tooltipTimer1 = setTimeout(() => { showTooltip.value = true }, 2000)
  tooltipTimer2 = setTimeout(() => { showTooltip.value = false }, 8000)
})

onBeforeUnmount(() => {
  if (darkObserver) darkObserver.disconnect()
  clearTimeout(tooltipTimer1)
  clearTimeout(tooltipTimer2)
})
</script>

<template>
  <div
    class="cat-mascot-wrapper"
    :style="{ right: pos.x + 'px', bottom: pos.y + 'px' }"
  >
    <Transition name="chat-slide">
      <CatChatDialog v-if="isOpen" @close="closeChat" />
    </Transition>

    <div
      class="cat-mascot"
      :class="{ hovered: isHovered, 'chat-open': isOpen, dragging: drag.hasMoved }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerenter="isHovered = true"
      @pointerleave="isHovered = false"
      :style="{ cursor: drag.hasMoved ? 'grabbing' : 'grab' }"
      role="button"
      :aria-label="isOpen ? '关闭猫咪对话' : '与猫咪对话'"
      tabindex="0"
      @keydown.enter="toggleChat"
    >
      <img src="/cat.png" alt="小猫" class="cat-img" draggable="false" />

      <div v-if="!isOpen && !drag.hasMoved" class="cat-tooltip">点击与我聊天喵~</div>
    </div>
  </div>
</template>

<style scoped>
.cat-mascot-wrapper {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.cat-mascot {
  width: 80px;
  height: 96px;
  position: relative;
  animation: cat-float 3s ease-in-out infinite;
  transition: transform 0.3s ease, filter 0.3s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

.cat-mascot.hovered:not(.dragging) {
  animation: cat-wiggle 0.6s ease-in-out;
  transform: scale(1.08);
  filter: drop-shadow(0 4px 16px rgba(0,0,0,0.15));
}

.cat-mascot.chat-open {
  animation: none;
  transform: scale(1.05);
}

.cat-mascot.dragging {
  animation: none;
  transform: scale(1.05);
  filter: drop-shadow(0 8px 24px rgba(0,0,0,0.2));
  transition: filter 0.15s;
}

.cat-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.10));
  transition: filter 0.3s;
  pointer-events: none;
}

:root.dark .cat-img {
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
}

.cat-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: -8px;
  background: var(--card-bg, #fff);
  color: var(--text-color, #333);
  font-size: 0.72rem;
  padding: 6px 12px;
  border-radius: 8px;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  animation: tooltip-in 0.3s ease-out;
  pointer-events: none;
}

.cat-tooltip::after {
  content: '';
  position: absolute;
  bottom: -4px;
  right: 18px;
  width: 8px;
  height: 8px;
  background: var(--card-bg, #fff);
  transform: rotate(45deg);
}

@keyframes cat-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes cat-wiggle {
  0%, 100% { transform: scale(1.08) rotate(0deg); }
  25% { transform: scale(1.08) rotate(-4deg); }
  75% { transform: scale(1.08) rotate(4deg); }
}

@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-slide-enter-active {
  animation: chat-in 0.35s ease-out;
}

.chat-slide-leave-active {
  animation: chat-in 0.25s ease-in reverse;
}

@keyframes chat-in {
  from { opacity: 0; transform: translateY(12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

:root.dark .cat-tooltip { background: #2d2d2d; color: #e0e0e0; }
:root.dark .cat-tooltip::after { background: #2d2d2d; }

@media (max-width: 700px) {
  .cat-mascot { width: 64px; height: 78px; }
  .cat-tooltip { font-size: 0.65rem; padding: 4px 10px; }
}
</style>
