<script setup>
import { ref, onMounted, watch } from 'vue'
import { photos } from '../api'
import { useAuthStore } from '../stores'
import Lightbox from '../components/Lightbox.vue'
import DarkroomPrint from '../components/DarkroomPrint.vue'

const authStore = useAuthStore()

const stats = ref([])
const loading = ref(true)
const selectedYear = ref(null)
const yearPhotos = ref([])

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

const darkroomPhoto = ref(null)
const showDarkroom = ref(false)

const loadStats = async () => {
  loading.value = true
  try {
    const res = await photos.getTimelineStats()
    stats.value = res.stats
    if (stats.value.length > 0) {
      selectYear(stats.value[0].year)
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const selectYear = async (year) => {
  selectedYear.value = year
  try {
    const res = await photos.list({ year, limit: 100, sort: 'date' })
    yearPhotos.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const formatDate = (d) => {
  if (!d) return ''
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[2]}.${m[3]}`
  return d.slice(0, 10)
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

onMounted(loadStats)

watch(() => authStore.token, () => {
  selectedYear.value = null
  loadStats()
})
</script>

<template>
  <div class="timeline-page">
    <h2 class="page-title">时间轴</h2>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <!-- Year Strip -->
      <div v-if="stats.length > 0" class="year-strip">
        <button
          v-for="s in stats"
          :key="s.year"
          class="year-chip"
          :class="{ active: selectedYear === s.year }"
          @click="selectYear(s.year)"
        >
          <span class="year-num">{{ s.year }}</span>
          <span class="year-count">{{ s.count }} 张</span>
        </button>
      </div>

      <!-- Axis Timeline -->
      <div v-if="yearPhotos.length > 0" class="axis-container">
        <div class="axis-line"></div>

        <div
          v-for="(photo, i) in yearPhotos"
          :key="photo.id"
          class="axis-entry"
          :class="i % 2 === 0 ? 'left' : 'right'"
        >
          <div class="entry-dot"></div>

          <div class="entry-photo-wrap" @click="openLightbox(i)">
            <div class="photo-paper" :style="{ transform: `rotate(${i % 2 === 0 ? '' : '-'}${(Math.random() * 1.4 + 0.3).toFixed(1)}deg)` }">
              <img
                :src="photo.thumbnail_url || photo.url"
                :alt="photo.title"
                class="photo-img"
                crossorigin="anonymous"
              />
            </div>
          </div>

          <div class="entry-card" @click="openLightbox(i)">
            <div class="card-date">{{ formatDate(photo.shot_date) }}</div>
            <div v-if="photo.title" class="card-title">{{ photo.title }}</div>
            <div v-if="photo.mood" class="card-mood">{{ photo.mood }}</div>
            <div v-if="photo.location" class="card-location">{{ photo.location }}</div>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="empty">暂无照片</div>
    </template>

    <Lightbox
      :photos="yearPhotos"
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
.timeline-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

.page-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin: 0 0 28px;
}

/* Year Strip */
.year-strip {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 48px;
}

.year-chip {
  flex: 1;
  min-width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 16px;
  border: 1px solid var(--n-300);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s;
}

.year-chip:hover {
  border-color: #000;
}

.year-chip.active {
  background: #000;
  border-color: #000;
  color: #fff;
}

.year-num {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.year-count {
  font-size: 0.7rem;
  opacity: 0.5;
  font-weight: 400;
}

.year-chip.active .year-count { opacity: 0.6; }

/* Axis Container */
.axis-container {
  position: relative;
}

.axis-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--n-300);
  transform: translateX(-50%);
}

/* Entry */
.axis-entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 16px 0 40px;
}

.entry-dot {
  position: absolute;
  left: 50%;
  top: 28px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #000;
  transform: translateX(-50%);
  z-index: 2;
}

/* Left entry — photo right, card left */
.axis-entry.left {
  flex-direction: row;
}
.axis-entry.left .entry-photo-wrap {
  order: 2;
  margin-left: auto;
  padding-left: 60px;
  width: 50%;
}
.axis-entry.left .entry-card {
  order: 1;
  margin-right: auto;
  padding-right: 60px;
  width: 50%;
  text-align: right;
}

/* Right entry — photo left, card right */
.axis-entry.right {
  flex-direction: row;
}
.axis-entry.right .entry-photo-wrap {
  order: 1;
  margin-right: auto;
  padding-right: 60px;
  width: 50%;
}
.axis-entry.right .entry-card {
  order: 2;
  margin-left: auto;
  padding-left: 60px;
  width: 50%;
  text-align: left;
}

/* Photo Paper */
.entry-photo-wrap {
  cursor: pointer;
  flex-shrink: 0;
}

.photo-paper {
  background: #fff;
  padding: 6px;
  border-radius: 2px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: box-shadow 0.3s, transform 0.3s;
  display: inline-block;
}

.photo-paper:hover {
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.photo-img {
  display: block;
  width: 100%;
  max-width: 240px;
  height: auto;
  object-fit: cover;
  aspect-ratio: attr(width) / attr(height);
}

/* Card */
.entry-card {
  cursor: pointer;
  padding-top: 8px;
}

.card-date {
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-style: italic;
  font-size: 0.82rem;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 3px;
  line-height: 1.4;
}

.card-mood {
  font-size: 0.88rem;
  color: var(--text-secondary);
  font-weight: 400;
  line-height: 1.5;
  margin-bottom: 4px;
}

.card-location {
  font-size: 0.78rem;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: var(--text-tertiary);
}

/* Loading & Empty */
.loading, .empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 700px) {
  .axis-line { left: 20px; }
  .entry-dot { left: 20px; }

  .axis-entry,
  .axis-entry.left,
  .axis-entry.right {
    flex-direction: column;
    padding-left: 44px;
  }

  .axis-entry.left .entry-photo-wrap,
  .axis-entry.right .entry-photo-wrap,
  .axis-entry.left .entry-card,
  .axis-entry.right .entry-card {
    width: 100%;
    padding: 0;
    margin: 0;
    text-align: left;
  }

  .axis-entry.left .entry-photo-wrap,
  .axis-entry.right .entry-photo-wrap {
    margin-bottom: 10px;
  }

  .photo-img { max-width: 100%; }
}
</style>
