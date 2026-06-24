<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getProxyUrl } from '../../api'

const props = defineProps({
  photo: { type: Object, default: null },
  photoList: { type: Array, default: () => [] }
})

const emit = defineEmits(['selectPhoto', 'viewDetail', 'next'])

const containerRef = ref(null)
const imgRef = ref(null)
const loupeVisible = ref(false)
const loupeX = ref(-200)
const loupeY = ref(-200)
const loupeBgPos = ref('0px 0px')
const loupeBgSize = ref('100%')
const showPhotoSelector = ref(false)

let resizeObserver = null

const LOUPE_SIZE = 140
const ZOOM = 3

const updateLoupe = (e) => {
  if (!imgRef.value || !containerRef.value) { loupeVisible.value = false; return }

  const img = imgRef.value
  const containerRect = containerRef.value.getBoundingClientRect()
  const mx = e.clientX - containerRect.left
  const my = e.clientY - containerRect.top

  const naturalW = img.naturalWidth || 1
  const naturalH = img.naturalHeight || 1
  const cw = containerRect.width
  const ch = containerRect.height

  const scale = Math.max(cw / naturalW, ch / naturalH)
  const renderW = naturalW * scale
  const renderH = naturalH * scale
  const cropX = (renderW - cw) / 2
  const cropY = (renderH - ch) / 2

  const nativeRX = mx + cropX
  const nativeRY = my + cropY

  if (nativeRX >= 0 && nativeRX < renderW && nativeRY >= 0 && nativeRY < renderH) {
    loupeVisible.value = true
    loupeX.value = e.clientX - LOUPE_SIZE / 2
    loupeY.value = e.clientY - LOUPE_SIZE / 2
    const tx = -(nativeRX * ZOOM - LOUPE_SIZE / 2)
    const ty = -(nativeRY * ZOOM - LOUPE_SIZE / 2)
    loupeBgPos.value = `${tx}px ${ty}px`
    loupeBgSize.value = `${renderW * ZOOM}px ${renderH * ZOOM}px`
  } else {
    loupeVisible.value = false
  }
}

const handleMouseLeave = () => { loupeVisible.value = false }

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

watch(() => props.photo, () => { loupeVisible.value = false })

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {})
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="cs-wrapper">
    <p class="cs-hint">移动鼠标用放大镜检查照片细节</p>

    <div
      ref="containerRef"
      class="cs-container"
      @mousemove="updateLoupe"
      @mouseleave="handleMouseLeave"
      @click="emit('viewDetail')"
    >
      <img
        v-if="photo?.url"
        ref="imgRef"
        :src="getProxyUrl(photo.url)"
        class="cs-photo"
        alt=""
      />
      <div class="cs-safelight"></div>
      <div class="cs-label">接触印相 · 点击查看详情</div>
    </div>

    <div class="cs-controls">
      <button class="cs-btn" @click="prevPhoto" :disabled="currentIndex <= 0">上一张</button>
      <button class="cs-btn" @click="showPhotoSelector = true">选择照片</button>
      <button class="cs-btn" @click="nextPhoto">下一张</button>
    </div>

    <Teleport to="body">
      <div
        v-if="loupeVisible"
        class="loupe"
        :style="{ left: loupeX + 'px', top: loupeY + 'px' }"
      >
        <div
          class="loupe-inner"
          :style="{
            backgroundImage: `url(${getProxyUrl(photo?.url)})`,
            backgroundSize: loupeBgSize,
            backgroundPosition: loupeBgPos
          }"
        ></div>
        <div class="loupe-ring"></div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showPhotoSelector" class="photo-selector-overlay" @click.self="showPhotoSelector = false">
        <div class="photo-selector">
          <h3>选择照片</h3>
          <div class="photo-grid">
            <div v-for="p in photoList" :key="p.id" class="photo-thumb"
              :class="{ active: photo?.id === p.id }"
              :style="{ backgroundImage: `url(${getProxyUrl(p.thumbnail_url || p.url)})` }"
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
.cs-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cs-hint {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.cs-container {
  position: relative;
  width: 60vw;
  max-width: 700px;
  height: 45vh;
  max-height: 380px;
  border-radius: 4px;
  overflow: hidden;
  cursor: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.cs-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cs-safelight {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(180,60,60,0.08) 0%, rgba(180,60,60,0.03) 60%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}

.cs-label {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  color: rgba(255,255,255,0.4);
  font-size: 0.75rem;
  letter-spacing: 3px;
  pointer-events: none;
}

.cs-controls {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.cs-btn {
  padding: 6px 18px;
  border: 1px solid var(--input-border);
  background: var(--card-bg);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  color: var(--text-color);
}

.cs-btn:hover {
  border-color: var(--secondary-color);
  background: var(--hover-bg);
}

.loupe {
  position: fixed;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
  z-index: 1000;
  box-shadow:
    0 0 0 2px rgba(255,255,255,0.15),
    0 4px 20px rgba(0,0,0,0.4);
}

.loupe-inner {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  image-rendering: auto;
}

.loupe-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.08);
  pointer-events: none;
}

.cs-btn:disabled {
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
