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

const featuredPhoto = computed(() => {
  if (photoList.value.length === 0) return null
  return photoList.value[0]
})

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

const handleLightboxClose = () => {
  const photo = photoList.value[lightboxIndex.value]
  lightboxVisible.value = false
  if (photo) {
    router.push(`/photo/${photo.id}`)
  }
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

const addToFade = (el) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in')
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.1 })
  observer.observe(el)
}

watch(() => route.query, () => {
  loadPhotos(true)
}, { immediate: true })

onMounted(() => {
  loadStats()
  loadPopularTags()
})
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero-section" :style="featuredPhoto ? { backgroundImage: `url(${featuredPhoto.url || featuredPhoto.thumbnail_url})` } : {}">
      <ParticlesBg />
      <div class="hero-overlay"></div>
      <div class="hero-body">
        <h1 class="hero-title">光影手记</h1>
        <p class="hero-subtitle">用光影记录生活</p>
        <p v-if="featuredPhoto" class="hero-meta">
          {{ featuredPhoto.location || '每一次按下快门' }}
          <span v-if="featuredPhoto.shot_date"> · {{ featuredPhoto.shot_date.slice(0, 10) }}</span>
        </p>
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
        <div class="waterfall">
          <div
            v-for="(photo, index) in photoList"
            :key="photo.id"
            class="waterfall-item"
            @click="viewDetail(index)"
          >
            <div class="waterfall-img-wrap">
              <img
                :src="photo.thumbnail_url || photo.url"
                :alt="photo.title"
                :style="{ aspectRatio: (photo.width && photo.height) ? `${photo.width}/${photo.height}` : '1/1' }"
                loading="lazy"
              />
              <div class="waterfall-overlay">
                <div class="overlay-top">
                  <button
                    class="fav-btn"
                    :class="{ active: favoriteIds.has(photo.id) }"
                    @click="toggleFavorite(photo, $event)"
                  >{{ favoriteIds.has(photo.id) ? '♥' : '♡' }}</button>
                </div>
                <div class="overlay-bottom">
                  <div v-if="photo.tags && photo.tags.length" class="overlay-tags">
                    <span v-for="tag in photo.tags.slice(0, 2)" :key="tag.id" class="overlay-tag">{{ tag.name }}</span>
                  </div>
                  <p v-if="photo.title" class="overlay-title">{{ photo.title }}</p>
                  <p v-if="photo.location || photo.mood" class="overlay-meta">
                    {{ photo.location }}{{ photo.mood ? ' · ' + photo.mood : '' }}
                  </p>
                </div>
              </div>
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
    />
  </div>
</template>

<style scoped>
/* Hero */
.hero-section {
  position: relative;
  height: 100vh;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
  z-index: 1;
}
.hero-body {
  position: relative;
  z-index: 2;
  text-align: center;
  color: #fff;
  padding: 0 24px;
}
.hero-title {
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 200;
  letter-spacing: 0.15em;
  margin: 0 0 16px;
  text-shadow: 0 4px 40px rgba(0,0,0,0.5);
}
.hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.3rem);
  opacity: 0.7;
  font-weight: 300;
  letter-spacing: 0.08em;
  margin: 0 0 12px;
}
.hero-meta {
  font-size: 0.85rem;
  opacity: 0.5;
  font-weight: 300;
  margin: 0;
}
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
  background: rgba(255,255,255,0.4);
  border-radius: 2px;
}
@keyframes bounceDown {
  0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
  50% { transform: translateX(-50%) translateY(8px); opacity: 0.3; }
}

/* Stats */
.stats-section {
  padding: 48px 20px;
  background: #000;
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
  color: #fff;
  letter-spacing: -0.02em;
}
.stat-label {
  font-size: 0.82rem;
  color: rgba(255,255,255,0.4);
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
  padding: 0 20px;
}

/* Film Strip */
.film-section {
  padding: 40px 0;
}

/* Filter */
.filter-section {
  padding: 0 20px 32px;
}
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

/* Waterfall Gallery */
.gallery-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 60px;
}
.waterfall {
  columns: 3;
  column-gap: 16px;
}
@media (max-width: 900px) {
  .waterfall { columns: 2; }
}
@media (max-width: 540px) {
  .waterfall { columns: 1; }
}
.waterfall-item {
  break-inside: avoid;
  margin-bottom: 16px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
}
.waterfall-img-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
}
.waterfall-item img {
  width: 100%;
  display: block;
  transition: transform 0.4s;
  object-fit: cover;
}
.waterfall-item:hover img {
  transform: scale(1.04);
}

/* Hover overlay */
.waterfall-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
}
.waterfall-item:hover .waterfall-overlay {
  opacity: 1;
}
.overlay-top {
  display: flex;
  justify-content: flex-end;
}
.fav-btn {
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fav-btn:hover { transform: scale(1.1); }
.fav-btn.active { color: #e74c3c; }

.overlay-bottom {
  color: #fff;
}
.overlay-tags {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}
.overlay-tag {
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 0.7rem;
}
.overlay-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 2px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.overlay-meta {
  font-size: 0.75rem;
  opacity: 0.75;
  margin: 0;
}

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
