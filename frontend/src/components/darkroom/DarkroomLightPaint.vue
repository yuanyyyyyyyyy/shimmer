<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  photo: { type: Object, default: null },
  photoList: { type: Array, default: () => [] }
})

const emit = defineEmits(['next', 'selectPhoto'])

const showPhotoSelector = ref(false)

const containerRef = ref(null)
const canvasRef = ref(null)
const brushSize = ref(60)
const lightColor = ref('255,255,255')
const initialized = ref(false)

let ctx = null
let resizeObserver = null
let animId = null
let mouseX = -100
let mouseY = -100
let prevX = -100
let prevY = -100
let isDown = false
let canvasW = 0
let canvasH = 0

const colors = [
  { name: '纯白', color: '255,255,255', desc: '自然光' },
  { name: '暖黄', color: '255,220,150', desc: '钨丝灯' },
  { name: '冷蓝', color: '150,200,255', desc: '月光' },
  { name: '粉紫', color: '255,180,220', desc: '霓虹' },
  { name: '薄荷', color: '150,255,200', desc: '荧光' },
  { name: '琥珀', color: '255,180,100', desc: '烛光' },
]

const initCanvas = () => {
  if (!canvasRef.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  canvasW = rect.width
  canvasH = rect.height
  canvasRef.value.width = canvasW
  canvasRef.value.height = canvasH
  ctx = canvasRef.value.getContext('2d')
}

const getPos = (e) => {
  if (!containerRef.value) return { x: 0, y: 0 }
  const rect = containerRef.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

const drawLight = (x, y, size, color) => {
  if (!ctx) return
  const r = size * 0.5

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
  gradient.addColorStop(0, `rgba(${color}, 0.95)`)
  gradient.addColorStop(0.3, `rgba(${color}, 0.6)`)
  gradient.addColorStop(0.6, `rgba(${color}, 0.25)`)
  gradient.addColorStop(1, `rgba(${color}, 0)`)

  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

const drawLine = (x1, y1, x2, y2) => {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  if (dist < 1) return
  const steps = Math.max(1, Math.floor(dist / 3))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    const speedT = t
    const wobble = Math.sin(t * 20 + Date.now() * 0.01) * 2
    drawLight(x + wobble, y + wobble, brushSize.value + speedT * 10, lightColor.value)
  }
}

const fadeCanvas = () => {
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.025)'
  ctx.fillRect(0, 0, canvasW, canvasH)
}

const animate = () => {
  animId = requestAnimationFrame(animate)
  if (!ctx) return

  fadeCanvas()

  if (isDown && mouseX >= 0 && prevX >= 0) {
    drawLine(prevX, prevY, mouseX, mouseY)
  }

  if (isDown) {
    drawLight(mouseX, mouseY, brushSize.value, lightColor.value)
  }

  prevX = mouseX
  prevY = mouseY
}

const handleMouseDown = (e) => {
  isDown = true
  const pos = getPos(e)
  mouseX = pos.x
  mouseY = pos.y
  prevX = pos.x
  prevY = pos.y
}

const handleMouseMove = (e) => {
  const pos = getPos(e)
  mouseX = pos.x
  mouseY = pos.y
}

const handleMouseUp = () => { isDown = false }
const handleMouseLeave = () => { isDown = false }

const clearCanvas = () => {
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, canvasW, canvasH)
}

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
  initialized.value = false
  ctx = null
  clearCanvas()
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
  animate()
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (animId) cancelAnimationFrame(animId)
})
</script>

<template>
  <div class="lightpaint-wrapper">
    <p class="lightpaint-hint">按住鼠标拖动，用光在照片上画画</p>
    <div
      ref="containerRef"
      class="lightpaint-container"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    >
      <img v-if="photo?.url" :src="photo.url" class="photo-bg" alt="" />
      <div class="darkness-overlay"></div>
      <canvas ref="canvasRef" class="light-canvas"></canvas>

      <div class="lightpaint-tools">
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
        <div class="size-control">
          <input
            type="range"
            min="20"
            max="150"
            v-model.number="brushSize"
            class="size-slider"
          />
          <span class="size-label">{{ brushSize }}px</span>
        </div>
        <button class="clear-btn" @click="clearCanvas">清空</button>
      </div>
    </div>

    <div class="lightpaint-footer">
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
.lightpaint-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lightpaint-hint {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.lightpaint-container {
  position: relative;
  width: 80vw;
  max-width: 960px;
  height: 70vh;
  max-height: 600px;
  border-radius: 12px;
  overflow: hidden;
  cursor: none;
}

.photo-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.darkness-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.88);
}

.light-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  mix-blend-mode: screen;
}

.lightpaint-tools {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  padding: 8px 16px;
  border-radius: 24px;
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

.clear-btn {
  padding: 4px 12px;
  font-size: 0.75rem;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.8);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(255,255,255,0.25);
}

.lightpaint-footer {
  margin-top: 20px;
  display: flex;
  gap: 8px;
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
