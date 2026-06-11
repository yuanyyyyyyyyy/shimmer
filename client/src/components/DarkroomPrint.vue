<script setup>
import { ref, computed, watch } from 'vue'
import { favorites } from '../api'
import { getFingerprint } from '../stores'
import { error as showError } from '../composables/useToast'

const props = defineProps({
  photo: { type: Object, default: null },
  visible: { type: Boolean, default: false },
  pageMode: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const fp = getFingerprint()
const isFavorited = ref(false)
const loaded = ref(false)

const rotation = computed(() => {
  return (Math.random() * 2 - 1).toFixed(1)
})

// Initialize loaded for page mode
if (props.pageMode) {
  loaded.value = true
}

const formatDate = (d) => {
  if (!d) return ''
  return d.slice(0, 10)
}

const exifItems = computed(() => {
  const p = props.photo
  if (!p) return []
  const items = []
  if (p.camera) items.push(p.camera)
  if (p.lens) items.push(p.lens)
  if (p.aperture) items.push(p.aperture)
  if (p.shutter_speed) items.push(p.shutter_speed)
  if (p.iso) items.push(`ISO ${p.iso}`)
  return items
})

const loadFavoriteStatus = async () => {
  if (!props.photo) return
  try {
    const res = await favorites.check(props.photo.id, fp)
    isFavorited.value = res.isFavorited
  } catch (e) {}
}

const toggleFavorite = async () => {
  try {
    if (isFavorited.value) {
      await favorites.remove(props.photo.id, fp)
      isFavorited.value = false
    } else {
      await favorites.add(props.photo.id, fp)
      isFavorited.value = true
    }
  } catch (e) {
    showError(e.response?.data?.error || '操作失败')
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    loaded.value = false
    setTimeout(() => { loaded.value = true }, 50)
    loadFavoriteStatus()
  }
})

watch(() => props.photo, () => {
  loadFavoriteStatus()
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible || pageMode"
      class="darkroom-overlay"
      :class="{ 'page-mode': pageMode, visible: visible || pageMode }"
      @click="emit('close')"
    >
      <div class="darkroom-glow"></div>

      <div class="darkroom-panel" :class="{ loaded }" @click.stop>
        <div class="photo-paper" :style="{ transform: `rotate(${rotation}deg)` }">
          <div class="photo-border">
            <img
              v-if="photo"
              :src="photo.url"
              :alt="photo.title"
              class="photo-image"
              crossorigin="anonymous"
            />
          </div>
          <div class="paper-date">{{ formatDate(photo?.shot_date) }}</div>
        </div>

        <div class="film-strip" v-if="exifItems.length > 0">
          <span v-for="(item, i) in exifItems" :key="i">
            <span v-if="i > 0" class="film-sep">·</span>
            {{ item }}
          </span>
        </div>

        <div class="print-actions">
          <button class="action-btn fav-btn" :class="{ active: isFavorited }" @click="toggleFavorite">
            <svg width="18" height="18" viewBox="0 0 24 24" :fill="isFavorited ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span>{{ isFavorited ? 'FAVORITE' : 'FAVORITE' }}</span>
          </button>
          <a v-if="photo?.url" :href="photo.url" target="_blank" class="action-btn" title="查看原图">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>ORIGINAL</span>
          </a>
        </div>

        <div class="close-hint">点击遮罩关闭</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.darkroom-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.94);
  opacity: 0;
  transition: opacity 0.4s;
}
.darkroom-overlay.visible {
  opacity: 1;
}
.darkroom-overlay.page-mode {
  position: fixed;
  opacity: 1;
  z-index: 10000;
}

.darkroom-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60%;
  background: radial-gradient(ellipse at 50% 0%, rgba(60, 15, 15, 0.2), transparent 70%);
  pointer-events: none;
}

.darkroom-panel {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  transform: translateY(30px);
  opacity: 0;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s;
  padding: 20px;
  max-width: 800px;
  width: 100%;
  box-sizing: border-box;
}
.darkroom-panel.loaded {
  transform: translateY(0);
  opacity: 1;
}

.photo-paper {
  background: #fff;
  border-radius: 3px 5px 4px 5px;
  box-shadow: 0 8px 60px rgba(0,0,0,0.5);
  padding: 18px 18px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.1s;
  max-width: 90vw;
}

.photo-border {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.photo-image {
  max-width: 580px;
  max-height: 70vh;
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}

.paper-date {
  margin-top: 10px;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-style: italic;
  font-size: 0.85rem;
  color: #888;
  letter-spacing: 0.05em;
}

.film-strip {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.6;
}
.film-sep {
  margin: 0 8px;
  opacity: 0.4;
}

.print-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  padding: 8px 18px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.78rem;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  letter-spacing: 0.08em;
  text-decoration: none;
  transition: all 0.2s;
}
.action-btn:hover {
  background: rgba(255,255,255,0.12);
  color: #fff;
  border-color: rgba(255,255,255,0.25);
}
.fav-btn.active {
  color: #e74c3c;
  border-color: rgba(231, 76, 60, 0.3);
  background: rgba(231, 76, 60, 0.1);
}

.close-hint {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.2);
  font-family: 'SFMono-Regular', Consolas, monospace;
  letter-spacing: 0.1em;
  margin-top: 8px;
}

@media (max-width: 640px) {
  .photo-paper { padding: 12px 12px 10px; }
  .photo-image { max-height: 50vh; }
  .film-strip { font-size: 0.7rem; }
}
</style>
