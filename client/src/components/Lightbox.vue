<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { favorites } from '../api'
import { getFingerprint } from '../stores'
import { error } from '../composables/useToast'

const props = defineProps({
  photos: { type: Array, required: true },
  startIndex: { type: Number, default: 0 },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'detail'])

const currentIndex = ref(props.startIndex)
const isLoading = ref(true)
const isFavorited = ref(false)
const scale = ref(1)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const fp = getFingerprint()

const currentPhoto = computed(() => props.photos[currentIndex.value])

const loadFavoriteStatus = async () => {
  if (!currentPhoto.value) return
  try {
    const res = await favorites.check(currentPhoto.value.id, fp)
    isFavorited.value = res.isFavorited
  } catch (e) {}
}

const toggleFavorite = async () => {
  try {
    if (isFavorited.value) {
      await favorites.remove(currentPhoto.value.id, fp)
      isFavorited.value = false
    } else {
      await favorites.add(currentPhoto.value.id, fp)
      isFavorited.value = true
    }
  } catch (e) {
    error(e.response?.data?.error || '操作失败')
  }
}

const prev = () => {
  currentIndex.value = (currentIndex.value - 1 + props.photos.length) % props.photos.length
}

const next = () => {
  currentIndex.value = (currentIndex.value + 1) % props.photos.length
}

const handleKeydown = (e) => {
  if (!props.visible) return
  switch (e.key) {
    case 'Escape': emit('close'); break
    case 'ArrowLeft': prev(); break
    case 'ArrowRight': next(); break
  }
}

const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  scale.value = Math.max(0.5, Math.min(3, scale.value + delta))
}

const startDrag = (e) => {
  isDragging.value = true
  dragStart.value = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
}

const onDrag = (e) => {
  if (!isDragging.value) return
  position.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
}

const endDrag = () => { isDragging.value = false }

const resetTransform = () => {
  scale.value = 1
  position.value = { x: 0, y: 0 }
}

const formatMeta = () => {
  const p = currentPhoto.value
  if (!p) return ''
  const parts = []
  if (p.shot_date) parts.push(p.shot_date.slice(0, 10))
  if (p.location) parts.push(p.location)
  return parts.join(' · ')
}

watch(currentIndex, () => {
  isLoading.value = true
  resetTransform()
  loadFavoriteStatus()
})

watch(() => props.visible, (val) => {
  if (val) {
    currentIndex.value = props.startIndex
    loadFavoriteStatus()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  loadFavoriteStatus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="lightbox" @wheel="handleWheel">
      <!-- overlay click to close -->
      <div class="lightbox-bg" @click.self="emit('close')"></div>

      <!-- loading -->
      <div v-if="isLoading" class="lightbox-loading">···</div>

      <!-- close -->
      <button class="btn-close" @click="emit('close')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>

      <!-- favorite -->
      <button class="btn-fav" :class="{ active: isFavorited }" @click="toggleFavorite" :title="isFavorited ? '取消收藏' : '收藏'">
        <svg v-if="isFavorited" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>

      <!-- detail -->
      <button class="btn-info" @click="emit('detail', currentPhoto)" title="详细信息">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>

      <!-- arrows -->
      <button v-if="photos.length > 1" class="btn-arrow left" @click="prev">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button v-if="photos.length > 1" class="btn-arrow right" @click="next">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <!-- image -->
      <div
        class="image-area"
        @mousedown="startDrag"
        @mousemove="onDrag"
        @mouseup="endDrag"
        @mouseleave="endDrag"
      >
        <img
          v-if="currentPhoto"
          :src="currentPhoto.url"
          :alt="currentPhoto.title"
          class="lightbox-img"
          :style="{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }"
          @load="isLoading = false"
          @click.self="emit('close')"
        />
      </div>

      <!-- metadata -->
      <div class="meta-bar">
        <span class="meta-text">{{ formatMeta() }}</span>
        <span v-if="currentPhoto?.mood" class="meta-mood">{{ currentPhoto.mood }}</span>
        <span v-if="photos.length > 1" class="meta-counter">{{ currentIndex + 1 }} / {{ photos.length }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.lightbox-bg {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.95);
}

/* loading */
.lightbox-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255,255,255,0.3);
  font-size: 1.5rem;
  letter-spacing: 0.3em;
  z-index: 1;
}

/* close */
.btn-close {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  padding: 8px;
  transition: color 0.2s, opacity 0.2s;
  opacity: 0;
}
.lightbox:hover .btn-close { opacity: 1; }
.btn-close:hover { color: #fff; }

/* favorite */
.btn-fav {
  position: absolute;
  top: 20px;
  right: 60px;
  z-index: 10;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  padding: 8px;
  transition: color 0.2s, opacity 0.2s, transform 0.2s;
  opacity: 0;
}
.lightbox:hover .btn-fav { opacity: 1; }
.btn-fav:hover { color: #fff; transform: scale(1.1); }
.btn-fav.active { color: #e74c3c; opacity: 1; }
.btn-fav.active:hover { color: #e74c3c; }

/* info */
.btn-info {
  position: absolute;
  top: 20px;
  right: 100px;
  z-index: 10;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  padding: 8px;
  transition: color 0.2s, opacity 0.2s;
  opacity: 0;
}
.lightbox:hover .btn-info { opacity: 1; }
.btn-info:hover { color: #fff; }

/* arrows */
.btn-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  padding: 20px 12px;
  transition: color 0.2s, opacity 0.2s;
  opacity: 0;
}
.lightbox:hover .btn-arrow { opacity: 1; }
.btn-arrow:hover { color: #fff; }
.btn-arrow.left { left: 12px; }
.btn-arrow.right { right: 12px; }

/* image */
.image-area {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 60px 80px;
  box-sizing: border-box;
  overflow: hidden;
}
.lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  transition: transform 0.05s;
}

/* metadata */
.meta-bar {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 18px;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  opacity: 0;
  transition: opacity 0.3s;
}
.lightbox:hover .meta-bar { opacity: 1; }
.meta-text { font-size: 0.82rem; color: rgba(255,255,255,0.7); }
.meta-mood { font-size: 0.82rem; color: rgba(255,255,255,0.5); font-style: italic; }
.meta-counter { font-size: 0.75rem; color: rgba(255,255,255,0.35); }

@media (max-width: 768px) {
  .image-area { padding: 50px 30px; }
  .meta-bar { opacity: 1; }
  .btn-close, .btn-fav, .btn-arrow { opacity: 1; }
}
</style>
