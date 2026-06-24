<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { favorites, getProxyUrl } from '../api'
import { useAuthStore, getFingerprint } from '../stores'
import Lightbox from '../components/Lightbox.vue'
import DarkroomPrint from '../components/DarkroomPrint.vue'

const authStore = useAuthStore()
const fp = getFingerprint()
const list = ref([])
const loading = ref(true)

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

const darkroomPhoto = ref(null)
const showDarkroom = ref(false)

const photoList = computed(() =>
  list.value.map(item => ({
    id: item.photo_id,
    url: item.url,
    thumbnail_url: item.thumbnail_url || item.url,
    title: item.title,
    mood: item.mood,
    shot_date: item.shot_date,
    location: item.location,
    camera: item.camera,
    lens: item.lens,
    aperture: item.aperture,
    shutter_speed: item.shutter_speed,
    iso: item.iso
  }))
)

const loadFavorites = async () => {
  loading.value = true
  try {
    const res = await favorites.list()
    list.value = res.favorites.map(item => ({
      ...item,
      _rotation: (Math.random() * 2 - 1).toFixed(1)
    }))
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const openLightbox = (index) => {
  lightboxIndex.value = index
  lightboxVisible.value = true
}

const handleLightboxClose = () => {
  lightboxVisible.value = false
}

const handleDarkroomDetail = (photo) => {
  darkroomPhoto.value = photo
  showDarkroom.value = true
}

const handleDarkroomClose = () => {
  showDarkroom.value = false
  darkroomPhoto.value = null
}

const formatDate = (d) => {
  if (!d) return ''
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[2]}.${m[3]}`
  return d.slice(0, 10)
}

const exifString = (item) => {
  const parts = []
  if (item.camera) parts.push(item.camera)
  if (item.lens) parts.push(item.lens)
  if (item.aperture) parts.push(item.aperture)
  if (item.shutter_speed) parts.push(item.shutter_speed)
  if (item.iso) parts.push(`ISO${item.iso}`)
  return parts.join(' · ')
}

onMounted(loadFavorites)

watch(() => authStore.token, () => {
  loadFavorites()
})
</script>

<template>
  <div class="favorites-page">
    <div class="fav-header">
      <h1 class="fav-title">收藏</h1>
      <span v-if="list.length > 0" class="fav-count">{{ list.length }}</span>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="list.length === 0">
      <div class="empty">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <p class="empty-text">还没有收藏</p>
        <p class="empty-hint">浏览照片时点击 ♡ 即可收藏</p>
        <router-link to="/" class="empty-link">去发现照片</router-link>
      </div>
    </template>

    <div v-else class="fav-list">
      <div
        v-for="(item, index) in list"
        :key="item.id || item.photo_id"
        class="fav-entry"
        @click="openLightbox(index)"
      >
        <div class="entry-photo">
          <div class="photo-paper" :style="{ transform: `rotate(${item._rotation}deg)` }">
            <img
              :src="getProxyUrl(item.thumbnail_url || item.url)"
              :alt="item.title"
              class="photo-img"
              loading="lazy"
            />
          </div>

        </div>

        <div class="entry-meta">
          <div class="meta-date">{{ formatDate(item.shot_date) }}</div>
          <div v-if="item.title" class="meta-title">{{ item.title }}</div>
          <div v-if="item.mood" class="meta-mood">{{ item.mood }}</div>
          <div v-if="item.location" class="meta-location">{{ item.location }}</div>
          <div v-if="exifString(item)" class="meta-exif">{{ exifString(item) }}</div>
        </div>
      </div>
    </div>

    <Lightbox
      :photos="photoList"
      :start-index="lightboxIndex"
      :visible="lightboxVisible"
      @close="handleLightboxClose"
      @detail="handleDarkroomDetail"
    />

    <DarkroomPrint
      :photo="darkroomPhoto"
      :visible="showDarkroom"
      @close="handleDarkroomClose"
    />
  </div>
</template>

<style scoped>
.favorites-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

/* Header */
.fav-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 36px;
}

.fav-title {
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  margin: 0;
  color: var(--text-color);
}

.fav-count {
  font-size: 0.8rem;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--text-tertiary);
}

/* List */
.fav-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.fav-entry {
  display: flex;
  gap: 32px;
  cursor: pointer;
  padding: 16px 0;
  border-bottom: 1px solid var(--n-200);
  transition: opacity 0.2s;
}

.fav-entry:hover {
  opacity: 0.85;
}

.fav-entry:last-child {
  border-bottom: none;
}

/* Photo side */
.entry-photo {
  flex: 0 0 200px;
  position: relative;
}

.photo-paper {
  background: #fff;
  padding: 6px;
  border-radius: 2px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  line-height: 0;
}

.photo-img {
  width: 100%;
  height: auto;
  display: block;
}

/* Meta side */
.entry-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
}

.meta-date {
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-style: italic;
  font-size: 1.1rem;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}

.meta-title {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 2px;
}

.meta-mood {
  font-size: 0.92rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.meta-location {
  font-size: 0.88rem;
  color: var(--text-tertiary);
}

.meta-exif {
  margin-top: 6px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  line-height: 1.5;
}

/* Empty State */
.empty {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  margin-bottom: 16px;
}

.empty-text {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.empty-hint {
  font-size: 0.84rem;
  color: var(--text-tertiary);
  margin: 0 0 20px;
}

.empty-link {
  display: inline-block;
  font-size: 0.88rem;
  color: #000;
  text-decoration: none;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
}

.empty-link:hover {
  opacity: 0.7;
}

/* Loading */
.loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 640px) {
  .fav-entry {
    flex-direction: column;
    gap: 16px;
  }

  .entry-photo {
    flex: none;
    width: 100%;
    max-width: 300px;
  }

  .remove-btn {
    top: 2px;
    right: 2px;
  }
}
</style>
