<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { photos, favorites, tags as tagApi, stats as statsApi } from '../api'
import { getFingerprint } from '../stores'
import { useAuthStore } from '../stores'
import { error as showError } from '../composables/useToast'
import ParticlesBg from '../components/ParticlesBg.vue'
import FilmStrip from '../components/FilmStrip.vue'
import Lightbox from '../components/Lightbox.vue'
import DarkroomPrint from '../components/DarkroomPrint.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const fp = getFingerprint()

const photoList = ref([])
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => photoList.value.length < total.value)
const favoriteIds = ref(new Set())
const stats = ref(null)
const popularTags = ref([])
const activeTagId = ref(null)

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

const darkroomPhoto = ref(null)
const showDarkroom = ref(false)

const featuredPhoto = computed(() => {
  if (photoList.value.length === 0) return null
  return photoList.value[0]
})

const decoPhotos = computed(() => photoList.value.slice(1, 6))

const getWallStyle = (photo, index) => {
  const anchors = [
    { top: 8,  left: 18, size: 100, rotate: -3 },
    { top: 22, left: 45, size: 110, rotate: 2 },
    { top: 48, left: 22, size: 90,  rotate: -1 },
    { top: 62, left: 50, size: 105, rotate: 4 },
    { top: 36, left: 62, size: 95,  rotate: -4 },
  ]
  const a = anchors[index]
  const jitter = (photo.id * 7 + index * 13) % 20
  return {
    width: `${a.size}px`,
    height: `${a.size}px`,
    top: `${a.top + (jitter % 7) - 3}%`,
    left: `${a.left + ((jitter * 3) % 9) - 4}%`,
    transform: `rotate(${(a.rotate + ((jitter % 5) - 2)).toFixed(1)}deg)`,
    zIndex: index + 1
  }
}

const loadStats = async () => {
  try {
    const res = await statsApi.get()
    stats.value = res
  } catch (e) {}
}

const loadPopularTags = async () => {
  try {
    const res = await tagApi.getPopular(8)
    popularTags.value = res.tags || []
  } catch (e) {}
}

const loadPhotos = async (reset = false) => {
  if (loading.value) return
  loading.value = true

  const search = route.query.search || ''
  const tag = route.query.tag || ''
  activeTagId.value = tag || null

  try {
    const params = {
      page: reset ? 1 : page.value,
      limit: 20,
      sort: 'random'
    }
    if (search) params.search = search
    if (tag) params.tag = tag

    const res = await photos.list(params)
    if (reset) {
      photoList.value = res.data
      page.value = 1
    } else {
      photoList.value = [...photoList.value, ...res.data]
    }
    total.value = res.total
    checkFavorites(res.data)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const checkFavorites = async (list) => {
  for (const p of list) {
    try {
      const res = await favorites.check(p.id, fp)
      if (res.isFavorited) favoriteIds.value.add(p.id)
    } catch (e) {}
  }
}

const toggleFavorite = async (photo, e) => {
  e.preventDefault()
  e.stopPropagation()
  try {
    if (favoriteIds.value.has(photo.id)) {
      await favorites.remove(photo.id, fp)
      favoriteIds.value.delete(photo.id)
    } else {
      await favorites.add(photo.id, fp)
      favoriteIds.value.add(photo.id)
    }
    favoriteIds.value = new Set(favoriteIds.value)
  } catch (e) {
    showError(e.response?.data?.error || '操作失败')
  }
}

const loadMore = () => {
  page.value++
  loadPhotos()
}

const viewDetail = (index) => {
  lightboxIndex.value = index
  lightboxVisible.value = true
}

const handleDarkroomDetail = (photo) => {
  darkroomPhoto.value = photo
  showDarkroom.value = true
}

const handleDarkroomClose = () => {
  showDarkroom.value = false
  darkroomPhoto.value = null
}

const handleLightboxClose = () => {
  lightboxVisible.value = false
}

const filterByTag = (tagId) => {
  if (activeTagId.value === String(tagId)) {
    router.push({ path: '/' })
  } else {
    router.push({ path: '/', query: { tag: tagId } })
  }
}

const clearFilters = () => {
  router.push({ path: '/' })
}

watch(() => route.query, () => {
  loadPhotos(true)
}, { immediate: true })

onMounted(() => {
  loadStats()
  loadPopularTags()
})

const getCardStyle = (photo) => {
  const seed = (photo.id * 7 + 3) % 360
  const rotate = ((seed % 13) - 6) * 1.1
  const highlight = (seed % 7) < 2
  return {
    transform: highlight
      ? `scale(1.18) rotate(${(rotate * 0.3).toFixed(1)}deg)`
      : 'none',
    zIndex: highlight ? 10 : (seed % 5) + 1,
    '--hl': highlight ? '1' : '0'
  }
}
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero-section">
      <ParticlesBg />
      <div class="hero-bg"></div>
      <div class="hero-layout">
        <div class="hero-text-block">
          <h1 class="hero-title">光影手记</h1>
          <div class="hero-rule"></div>
          <p class="hero-subtitle">用光影记录生活</p>
          <p v-if="featuredPhoto" class="hero-meta">
            {{ featuredPhoto.location || '每一次按下快门' }}
            <span v-if="featuredPhoto.shot_date"> · {{ featuredPhoto.shot_date.slice(0, 10) }}</span>
          </p>
        </div>
        <div class="hero-wall" v-if="decoPhotos.length">
          <div
            v-for="(photo, i) in decoPhotos"
            :key="photo.id"
            class="wall-photo"
            :style="getWallStyle(photo, i)"
          >
            <img :src="photo.url || photo.thumbnail_url" />
          </div>
        </div>
      </div>
      <div class="scroll-hint">
        <span class="scroll-dot"></span>
      </div>
    </section>

    <!-- Stats -->
    <section v-if="stats" class="stats-section" ref="statsRef">
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-number">{{ stats.photos }}</span>
          <span class="stat-label">张照片</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ stats.stories }}</span>
          <span class="stat-label">个故事</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ stats.albums }}</span>
          <span class="stat-label">本相册</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ stats.days }}</span>
          <span class="stat-label">天记录</span>
        </div>
      </div>
    </section>

    <!-- Film Strip -->
    <section v-if="photoList.length > 0" class="film-section">
      <div class="section-label">光影长廊</div>
      <FilmStrip :photos="photoList" @select="viewDetail(photoList.indexOf($event))" />
    </section>

    <!-- Category Filter -->
    <section v-if="popularTags.length > 0" class="filter-section">
      <div class="section-label">探索分类</div>
      <div class="filter-pills">
        <button
          :class="{ active: !activeTagId }"
          @click="clearFilters"
        >全部</button>
        <button
          v-for="tag in popularTags"
          :key="tag.id"
          :class="{ active: activeTagId === String(tag.id) }"
          @click="filterByTag(tag.id)"
        >{{ tag.name }}</button>
      </div>
    </section>

    <!-- Waterfall Gallery -->
    <section class="gallery-section">
      <div v-if="route.query.search || route.query.tag" class="filter-status">
        <span v-if="route.query.search">搜索: "{{ route.query.search }}"</span>
        <span v-if="route.query.tag">标签筛选</span>
        <button @click="clearFilters">清除</button>
      </div>

      <div v-if="loading && photoList.length === 0" class="loading">加载中...</div>

      <div v-else-if="photoList.length === 0" class="empty">
        <p>暂无照片</p>
        <router-link to="/" class="link-btn">去看看</router-link>
      </div>

      <template v-else>
        <div class="gallery-floating">
          <div
            v-for="(photo, index) in photoList"
            :key="photo.id"
            class="f-card"
            :style="getCardStyle(photo)"
            @click="viewDetail(index)"
          >
            <div class="f-card-img">
              <img
                :src="photo.url || photo.thumbnail_url"
                :alt="photo.title"
                loading="lazy"
              />
            </div>
            <div class="f-card-label">
              <span v-if="photo.location" class="f-location">{{ photo.location }}</span>
              <span v-if="photo.title" class="f-title">{{ photo.title }}</span>
              <span v-if="photo.mood && !photo.title" class="f-mood">{{ photo.mood }}</span>
            </div>
          </div>
        </div>

        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="hasMore" class="load-more">
          <button @click="loadMore">加载更多</button>
        </div>
        <div v-else-if="photoList.length > 0" class="all-loaded">已经到底了</div>
      </template>
    </section>

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
/* ===== Hero ===== */
.hero-section {
  position: relative;
  height: 380px;
  max-width: 960px;
  margin: 24px auto 0;
  border-radius: 4px;
  overflow: hidden;
}

.hero-section .hero-bg {
  position: absolute;
  inset: 0;
  background: oklch(97% 0 0);
  z-index: 0;
}
:root.dark .hero-section .hero-bg {
  background: oklch(16% 0 0);
}

.hero-section .hero-layout {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  align-items: stretch;
}

.hero-section .hero-text-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 0 0 48px;
  max-width: 500px;
}

/* --- 字体 --- */
.hero-section .hero-title {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 100;
  letter-spacing: 0.5em;
  margin: 0 0 12px;
  font-size: clamp(2.6rem, 5vw, 4rem);
  color: oklch(20% 0.01 85);
}
:root.dark .hero-section .hero-title {
  color: oklch(88% 0.01 85);
}

.hero-section .hero-rule {
  width: 40px;
  height: 1px;
  background: oklch(60% 0.02 85 / 0.4);
  margin: 20px 0;
}
:root.dark .hero-section .hero-rule {
  background: oklch(70% 0.02 85 / 0.3);
}

.hero-section .hero-subtitle {
  font-weight: 200;
  letter-spacing: 0.15em;
  margin: 0 0 8px;
  font-size: clamp(0.85rem, 1.5vw, 1.05rem);
  color: oklch(40% 0.02 85);
}
:root.dark .hero-section .hero-subtitle {
  color: oklch(75% 0.02 85);
}

.hero-section .hero-meta {
  font-weight: 200;
  letter-spacing: 0.06em;
  margin: 0;
  font-size: 0.78rem;
  color: oklch(50% 0.02 85);
  opacity: 0.55;
}
:root.dark .hero-section .hero-meta {
  color: oklch(65% 0.02 85);
}

/* --- 照片墙 --- */
.hero-section .hero-wall {
  position: relative;
  width: 45%;
  min-height: 280px;
  align-self: center;
  overflow: hidden;
}

.hero-section .wall-photo {
  position: absolute;
  box-sizing: border-box;
  padding: 5px 5px 18px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  overflow: hidden;
}
.hero-section .wall-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
:root.dark .hero-section .wall-photo {
  background: #eee;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}

/* --- scroll-hint --- */
.scroll-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  animation: bounceDown 2s ease infinite;
}
.scroll-dot {
  display: block;
  width: 2px;
  height: 24px;
  border-radius: 2px;
  background: oklch(60% 0 0 / 0.25);
}
:root.dark .scroll-dot {
  background: oklch(70% 0 0 / 0.25);
}
@keyframes bounceDown {
  0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
  50% { transform: translateX(-50%) translateY(8px); opacity: 0.3; }
}

/* ===== Particles overrides ===== */
.hero-section :deep(.particles-bg) {
  z-index: 3 !important;
}
:root.dark .hero-section :deep(.particles-bg) {
  opacity: 0.4;
}
:root:not(.dark) .hero-section :deep(.particles-bg) {
  filter: invert(1);
  opacity: 0.1;
}

/* Stats */
.stats-section {
  max-width: 960px;
  margin: 32px auto;
  padding: 32px 20px;
}
.stats-grid {
  max-width: 800px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}
@media (max-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
.stat-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-number {
  font-size: 2.2rem;
  font-weight: 700;
  color: #000;
  letter-spacing: -0.02em;
}
:root.dark .stat-number {
  color: #e0e0e0;
}
.stat-label {
  font-size: 0.82rem;
  color: var(--text-tertiary);
  font-weight: 400;
}

/* Section labels */
.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 16px;
  text-align: center;
}

/* Film Strip */
.film-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 20px;
}

/* Filter */
.filter-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px 32px;
}
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.filter-pills button {
  padding: 6px 18px;
  border-radius: 20px;
  border: 1px solid var(--n-300);
  background: transparent;
  font-size: 0.84rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.filter-pills button:hover {
  border-color: #000;
  color: #000;
}
.filter-pills button.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

.filter-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--n-200);
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 0.84rem;
}
.filter-status span { color: var(--text-secondary); }
.filter-status button {
  margin-left: auto;
  background: none;
  border: 1px solid var(--n-300);
  padding: 4px 12px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* ===== Floating Card Gallery ===== */
.gallery-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px 60px;
}

.gallery-floating {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 32px 0 12px;
  align-items: start;
}

.f-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s;
  position: relative;
}
.f-card:hover {
  transform: scale(1.04);
  box-shadow: 0 16px 40px rgba(0,0,0,0.14);
  z-index: 100 !important;
}
.f-card[style*="--hl: 1"] {
  transform: scale(1.18) !important;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
  z-index: 10 !important;
}
.f-card[style*="--hl: 1"]:hover {
  transform: scale(1.22) !important;
}

.f-card-img {
  width: 100%;
  height: 150px;
  overflow: hidden;
}
.f-card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.f-card-label {
  padding: 10px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.f-location {
  font-size: 0.68rem;
  color: #999;
  letter-spacing: 0.04em;
}
.f-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #333;
}
.f-mood {
  font-size: 0.75rem;
  font-style: italic;
  color: #999;
}

:root.dark .f-card {
  background: #2a2a2a;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
:root.dark .f-card:hover {
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
}
:root.dark .f-title { color: #e0e0e0; }
:root.dark .f-location,
:root.dark .f-mood { color: #888; }

/* Loading & More */
.loading, .empty, .load-more, .all-loaded {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}
.load-more button {
  background: #000;
  color: #fff;
  border: none;
  padding: 10px 32px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  transition: opacity 0.2s;
}
.load-more button:hover { opacity: 0.85; }

.link-btn {
  display: inline-block;
  margin-top: 12px;
  color: #000;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
}
</style>
