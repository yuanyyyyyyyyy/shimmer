<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  photo: { type: Object, default: null },
  photoList: { type: Array, default: () => [] }
})

const emit = defineEmits(['next', 'selectPhoto'])

const showPhotoSelector = ref(false)

const containerRef = ref(null)
const canvas = ref(null)
const progress = ref(0)
const showFlash = ref(false)
const initialized = ref(false)

let ctx = null
let animFrame = null
let progressTimer = null
let resizeObserver = null
let canvasW = 0
let canvasH = 0
let isDrawing = false
let lastX = 0
let lastY = 0
let brushRadius = 50

const BRUSH_HARDNESS = 0.6  // 0-1, 越硬边缘越锐利

const initCanvas = () => {
  if (!canvas.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  canvasW = rect.width
  canvasH = rect.height
  canvas.value.width = canvasW
  canvas.value.height = canvasH
  ctx = canvas.value.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)
}

const getPos = (e) => {
  if (!containerRef.value) return { x: 0, y: 0 }
  const rect = containerRef.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

const drawBrush = (x, y) => {
  if (!ctx) return
  ctx.globalCompositeOperation = 'destination-out'

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushRadius)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(BRUSH_HARDNESS, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, brushRadius, 0, Math.PI * 2)
  ctx.fill()
}

const drawLine = (fromX, fromY, toX, toY) => {
  if (!ctx) return
  const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2)
  const steps = Math.max(1, Math.floor(dist / 5))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = fromX + (toX - fromX) * t
    const y = fromY + (toY - fromY) * t
    drawBrush(x, y)
  }
}

const calculateProgress = () => {
  if (!ctx) return
  const imageData = ctx.getImageData(0, 0, canvasW, canvasH)
  const pixels = imageData.data
  let erased = 0
  const total = canvasW * canvasH
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 255) erased++
  }
  progress.value = Math.min(100, (erased / total) * 100)
  if (progress.value >= 100) {
    showFlash.value = true
    setTimeout(() => { showFlash.value = false }, 800)
  }
}

const handleMouseDown = (e) => {
  isDrawing = true
  const pos = getPos(e)
  lastX = pos.x
  lastY = pos.y
  drawBrush(pos.x, pos.y)
}

const handleMouseMove = (e) => {
  if (!isDrawing) return
  const pos = getPos(e)
  drawLine(lastX, lastY, pos.x, pos.y)
  lastX = pos.x
  lastY = pos.y
}

const handleMouseUp = () => {
  isDrawing = false
}

const handleMouseLeave = () => {
  isDrawing = false
}

const handleRevealAll = () => {
  if (!ctx) return
  ctx.clearRect(0, 0, canvasW, canvasH)
  progress.value = 100
  showFlash.value = true
  setTimeout(() => { showFlash.value = false }, 800)
}

const currentIndex = computed(() => {
  const idx = props.photoList.findIndex(p => p.id === props.photo?.id)
  return idx >= 0 ? idx : -1
})

const prevPhoto = () => {
  if (currentIndex.value > 0 && currentIndex.value < props.photoList.length) {
    emit('selectPhoto', props.photoList[currentIndex.value - 1])
  }
}

const nextPhoto = () => {
  if (currentIndex.value >= 0 && currentIndex.value < props.photoList.length - 1) {
    emit('selectPhoto', props.photoList[currentIndex.value + 1])
  } else {
    emit('next')
  }
}

const selectPhoto = (p) => { emit('selectPhoto', p) }

watch(() => props.photo, () => {
  showFlash.value = false
  progress.value = 0
  initialized.value = false
  ctx = null
  initCanvas()
})

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentBoxSize?.[0]?.inlineSize || entry.contentRect?.width
      const h = entry.contentBoxSize?.[0]?.blockSize || entry.contentRect?.height
      if (w > 0 && h > 0 && !initialized.value) {
        initialized.value = true
        initCanvas()
      }
    }
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
  progressTimer = setInterval(calculateProgress, 500)
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (animFrame) cancelAnimationFrame(animFrame)
  if (progressTimer) clearInterval(progressTimer)
})
</script>

<template>
  <div class="develop-wrapper">
    <p class="develop-hint">按住并拖动鼠标，像刷显影液一样让照片浮现</p>
    <div
      ref="containerRef"
      class="develop-container"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    >
      <img v-if="photo?.url" :src="photo.url" class="photo-bg" alt="" />
      <canvas ref="canvas" class="develop-canvas"></canvas>

      <div class="develop-info">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <span class="progress-label">{{ Math.round(progress) }}%</span>
      </div>

      <div v-if="progress >= 100" class="flash-overlay"></div>

      <div v-if="progress < 100" class="reveal-hint">
        已显影 <strong>{{ Math.round(progress) }}%</strong>
        <button class="reveal-btn" @click="handleRevealAll" v-if="progress > 30">一键显影</button>
      </div>
    </div>

    <div class="develop-footer">
      <p class="paper-texture-text">相纸 · 明胶银盐</p>
      <div class="develop-nav">
        <button class="nav-btn" @click="prevPhoto" :disabled="currentIndex <= 0">上一张</button>
        <button class="nav-btn" @click="showPhotoSelector = true">选择照片</button>
        <button class="nav-btn" @click="nextPhoto">下一张</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showPhotoSelector" class="photo-selector-overlay" @click.self="showPhotoSelector = false">
        <div class="photo-selector">
          <h3>选择照片</h3>
          <div class="photo-grid">
            <div v-for="p in photoList" :key="p.id" class="photo-thumb"
              :class="{ active: photo?.id === p.id }"
              :style="{ backgroundImage: `url(${p.thumbnail_url || p.url})` }"
              @click="selectPhoto(p); showPhotoSelector = false"
            ></div>
          </div>
          <button class="close-btn" @click="showPhotoSelector = false">关闭</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.develop-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.develop-hint {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 16px;
  text-align: center;
}

.develop-container {
  position: relative;
  width: 80vw;
  max-width: 960px;
  height: 70vh;
  max-height: 600px;
  background: #f5f0e8;
  border-radius: 4px;
  overflow: hidden;
  cursor: crosshair;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.photo-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.develop-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.develop-info {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 5;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  padding: 6px 14px;
  border-radius: 20px;
}

.progress-track {
  width: 160px;
  height: 4px;
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8a8a8a, #e0e0e0);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-label {
  color: #fff;
  font-size: 0.8rem;
  font-family: monospace;
  min-width: 36px;
  text-align: right;
}

.reveal-hint {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  padding: 6px 12px;
  border-radius: 20px;
}

.reveal-btn {
  padding: 3px 10px;
  font-size: 0.75rem;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.1);
  color: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.reveal-btn:hover {
  background: rgba(255,255,255,0.25);
}

.flash-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: #fff;
  animation: flash-pop 0.8s ease-out forwards;
  pointer-events: none;
}

@keyframes flash-pop {
  0% { opacity: 0.8; }
  100% { opacity: 0; }
}

.develop-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
}

.paper-texture-text {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-style: italic;
  letter-spacing: 2px;
}

.nav-btn {
  padding: 6px 18px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  color: var(--text-color);
}

.nav-btn:hover {
  border-color: var(--secondary-color);
  background: var(--hover-bg);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.develop-nav {
  display: flex;
  gap: 8px;
}

.photo-selector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-selector {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.photo-selector h3 {
  margin: 0 0 16px;
  text-align: center;
  color: #fff;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.photo-thumb {
  aspect-ratio: 4/3;
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  min-height: 100px;
}

.photo-thumb:hover { border-color: rgba(255,255,255,0.5); }
.photo-thumb.active { border-color: #4ade80; }

.photo-selector .close-btn {
  display: block;
  margin: 16px auto 0;
  padding: 8px 24px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.photo-selector .close-btn:hover { background: rgba(255,255,255,0.2); }
</style>
