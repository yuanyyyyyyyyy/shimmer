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
const brushSize = ref(45)
const lightColor = ref('255,255,255')
const previewX = ref(0)
const previewY = ref(0)
const showPreview = ref(false)
const trail = ref([])
const TRAIL_LENGTH = 15

let ctx = null
let progressTimer = null
let resizeObserver = null
let canvasW = 0
let canvasH = 0
let isDown = false
let lastX = -100
let lastY = -100

const colors = [
  { name: '纯白', color: '255,255,255', desc: '自然光' },
  { name: '暖黄', color: '255,220,150', desc: '钨丝灯' },
  { name: '冷蓝', color: '150,200,255', desc: '月光' },
  { name: '粉紫', color: '255,180,220', desc: '霓虹' },
  { name: '薄荷', color: '150,255,200', desc: '荧光' },
  { name: '琥珀', color: '255,180,100', desc: '烛光' },
]

const initCanvas = () => {
  if (!canvas.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  canvasW = rect.width
  canvasH = rect.height
  canvas.value.width = canvasW
  canvas.value.height = canvasH
  ctx = canvas.value.getContext('2d')
  ctx.globalCompositeOperation = 'source-over'
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
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize.value)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.6, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, brushSize.value, 0, Math.PI * 2)
  ctx.fill()
}

const drawLine = (fromX, fromY, toX, toY) => {
  const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2)
  const steps = Math.max(1, Math.floor(dist / 3))
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
  progress.value = Math.min(100, Math.round((erased / total) * 100))
  if (progress.value >= 100) {
    showFlash.value = true
    setTimeout(() => { showFlash.value = false }, 800)
  }
}

const handleRevealAll = () => {
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, canvasW, canvasH)
  progress.value = 100
  showFlash.value = true
  setTimeout(() => { showFlash.value = false }, 800)
}

const handleReset = () => {
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)
  progress.value = 0
}

const pushTrail = (x, y) => {
  trail.value.unshift({ x, y })
  if (trail.value.length > TRAIL_LENGTH) trail.value.length = TRAIL_LENGTH
}

const clearTrail = () => { trail.value = [] }

const handleMouseDown = (e) => {
  isDown = true
  const pos = getPos(e)
  lastX = pos.x
  lastY = pos.y
  drawBrush(pos.x, pos.y)
}

const handleMouseMove = (e) => {
  const pos = getPos(e)
  previewX.value = pos.x
  previewY.value = pos.y
  pushTrail(pos.x, pos.y)
  if (!isDown) return
  drawLine(lastX, lastY, pos.x, pos.y)
  lastX = pos.x
  lastY = pos.y
}

const handleMouseUp = () => { isDown = false; clearTrail() }
const handleMouseEnter = () => { showPreview.value = true }
const handleMouseLeave = () => { showPreview.value = false; isDown = false; clearTrail() }

const changeColor = (c) => { lightColor.value = c.color }

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
  if (progressTimer) clearInterval(progressTimer)
})
</script>

<template>
  <div class="dl-wrapper">
    <p class="dl-hint">按住拖动 · 显影液+光绘笔，一笔完成</p>
    <div
      ref="containerRef"
      class="dl-container"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <img v-if="photo?.url" :src="photo.url" class="photo-bg" alt="" />
      <canvas ref="canvas" class="dl-canvas"></canvas>
      <div
        v-for="(pos, i) in trail"
        :key="i"
        v-show="showPreview"
        class="brush-trail"
        :style="{
          width: brushSize * (1 - i * 0.04) + 'px',
          height: brushSize * (1 - i * 0.04) + 'px',
          transform: 'translate(' + (pos.x - brushSize * (1 - i * 0.04) / 2) + 'px, ' + (pos.y - brushSize * (1 - i * 0.04) / 2) + 'px)',
          opacity: Math.max(0, 1 - i * 0.065),
          '--color': lightColor
        }"
      ></div>
      <div
        v-show="showPreview"
        class="brush-preview"
        :style="{
          width: brushSize + 'px',
          height: brushSize + 'px',
          transform: 'translate(' + (previewX - brushSize / 2) + 'px, ' + (previewY - brushSize / 2) + 'px)',
          '--color': lightColor
        }"
      ></div>
      <div v-if="progress >= 100" class="flash-overlay"></div>
    </div>

    <div class="dl-toolbar">
      <div class="color-picker">
        <button
          v-for="c in colors"
          :key="c.name"
          class="color-btn"
          :class="{ active: lightColor === c.color }"
          :style="{ background: `rgb(${c.color})` }"
          :title="c.name + ' · ' + c.desc"
          @click="changeColor(c)"
        ></button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="size-control">
        <input type="range" min="2" max="150" v-model.number="brushSize" class="size-slider" />
        <span class="size-label">{{ brushSize }}px</span>
      </div>
      <div class="toolbar-divider"></div>
      <div class="progress-control">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <span class="progress-label">{{ progress }}%</span>
      </div>
      <button class="tool-btn" @click="handleRevealAll" v-if="progress < 100">一键显影</button>
      <button class="tool-btn" @click="handleReset">重置</button>
    </div>

    <div class="dl-footer">
      <button class="nav-btn" @click="prevPhoto" :disabled="currentIndex <= 0">上一张</button>
      <button class="nav-btn" @click="showPhotoSelector = true">选择照片</button>
      <button class="nav-btn" @click="nextPhoto">下一张</button>
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
.dl-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dl-hint {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 16px;
  text-align: center;
}

.dl-container {
  position: relative;
  width: 80vw;
  max-width: 960px;
  height: 70vh;
  max-height: 600px;
  background: #f5f0e8;
  border-radius: 4px;
  overflow: hidden;
  cursor: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.photo-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  z-index: 0;
}

.dl-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.brush-trail {
  position: absolute;
  z-index: 9;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at center, rgba(var(--color), 0.5) 0%, rgba(var(--color), 0.2) 40%, transparent 70%);
  box-shadow: 0 0 6px rgba(var(--color), 0.2);
  border: 1.5px solid rgba(var(--color), 0.5);
  transition: none;
}

.brush-preview {
  position: absolute;
  z-index: 10;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at center, rgba(var(--color), 0.7) 0%, rgba(var(--color), 0.3) 40%, transparent 70%);
  box-shadow:
    0 0 10px rgba(var(--color), 0.4),
    0 0 30px rgba(var(--color), 0.25);
  border: 2px solid rgba(var(--color), 0.8);
  transition: width 0.15s, height 0.15s;
}

.dl-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 8px 16px;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(6px);
  border-radius: 24px;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  background: rgba(255,255,255,0.15);
}

.color-picker {
  display: flex;
  gap: 6px;
}

.color-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.2);
}

.color-btn.active {
  border-color: #fff;
  box-shadow: 0 0 8px rgba(255,255,255,0.4);
}

.size-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.size-slider {
  width: 60px;
  height: 4px;
  accent-color: #fff;
  cursor: pointer;
}

.size-label {
  color: rgba(255,255,255,0.7);
  font-size: 0.7rem;
  font-family: monospace;
  min-width: 30px;
}

.progress-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-track {
  width: 80px;
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
  color: rgba(255,255,255,0.8);
  font-size: 0.75rem;
  font-family: monospace;
  min-width: 32px;
}

.tool-btn {
  padding: 4px 12px;
  font-size: 0.72rem;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.8);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.tool-btn:hover {
  background: rgba(255,255,255,0.25);
}

.flash-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #fff;
  animation: flash-pop 0.8s ease-out forwards;
  pointer-events: none;
}

@keyframes flash-pop {
  0% { opacity: 0.8; }
  100% { opacity: 0; }
}

.dl-footer {
  display: flex;
  gap: 8px;
  margin-top: 20px;
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
