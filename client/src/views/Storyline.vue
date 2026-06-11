<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storylines } from '../api'

const router = useRouter()
const stories = ref([])
const years = ref([])
const selectedYear = ref(null)
const loading = ref(true)
const error = ref(null)
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => stories.value.length < total.value)

const loadYears = async () => {
  try {
    const reviewData = await import('../api')
    const res = await reviewData.photos.getReviewYears()
    years.value = res.years || []
    if (years.value.length > 0 && !selectedYear.value) {
      selectedYear.value = years.value[0]
    }
  } catch (e) {
    console.error(e)
  }
}

const loadStories = async (reset = false) => {
  if (reset) {
    page.value = 1
    stories.value = []
  }
  loading.value = true
  error.value = null
  try {
    const res = await storylines.list({ year: selectedYear.value, page: page.value, limit: 15 })
    const newStories = (res.stories || []).map(s => ({
      date: s.story_date || s.date,
      location: s.location || '未知地点',
      photos: s.photos || [],
      tags: s.tags || [],
      photoCount: s.photo_count || (s.photos || []).length,
      aiSummary: s.ai_summary || s.aiSummary || null
    }))
    if (reset) {
      stories.value = newStories
    } else {
      stories.value = [...stories.value, ...newStories]
    }
    total.value = res.total || 0
  } catch (e) {
    error.value = e.response?.data?.error || e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadStories()
}

const changeYear = (year) => {
  selectedYear.value = year
  loadStories(true)
}

const normalizeDate = (dateVal) => {
  if (!dateVal) return ''
  const s = typeof dateVal === 'string' ? dateVal : String(dateVal)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(dateVal)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return s
}

const formatMagazineDate = (dateStr) => {
  if (!dateStr) return ''
  const parts = String(dateStr).split(/[-T\s]/)
  return `${parts[0]}.${(parts[1] || '01').padStart(2, '0')}`
}

const truncate = (text, maxLen) => {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

const goDetail = (story) => {
  const firstLoc = story.location.split(' / ')[0]
  router.push({
    name: 'StoryDetail',
    params: {
      date: normalizeDate(story.date),
      location: encodeURIComponent(firstLoc)
    }
  })
}

onMounted(async () => {
  await loadYears()
  if (selectedYear.value) {
    await loadStories()
  } else {
    loading.value = false
  }
})
</script>

<template>
  <div class="storyline-page">
    <div class="container">
      <header class="page-header">
        <h1>故事线</h1>
        <p class="section-sub">Travel Magazine · Editorial</p>
      </header>

      <div v-if="years.length > 0" class="year-strip">
        <span class="issue-label">ISSUE</span>
        <button
          v-for="y in years"
          :key="y"
          :class="{ active: selectedYear === y }"
          @click="changeYear(y)"
        >{{ y }}</button>
      </div>

      <div v-if="loading && stories.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>正在编织你的光影故事...</p>
      </div>

      <div v-else-if="error && stories.length === 0" class="empty-state">
        <p>{{ error }}</p>
        <button @click="loadStories(true)">重试</button>
      </div>

      <div v-else-if="!loading && stories.length === 0" class="empty-state">
        <p>{{ selectedYear ? `${selectedYear} 年还没有故事` : '还没有任何故事' }}</p>
        <router-link to="/" class="link-btn">去上传一些照片吧</router-link>
      </div>

      <template v-else>
        <div class="spreads">
          <div
            v-for="(story, idx) in stories"
            :key="`${story.date}-${story.location}-${idx}`"
            class="spread"
            :class="{ reverse: idx % 2 !== 0 }"
            @click="goDetail(story)"
          >
            <div class="spread-img">
              <img
                v-if="story.photos && story.photos[0]"
                :src="story.photos[0].url || story.photos[0].thumbnail_url"
                alt=""
              />
              <div v-else class="img-placeholder">—</div>
            </div>
            <div class="spread-text">
              <div class="spread-date">{{ formatMagazineDate(story.date) }}</div>
              <h2 class="spread-title">{{ story.location }}</h2>
              <div class="spread-meta">
                <span>{{ story.photoCount }} 张照片</span>
                <span v-if="story.tags && story.tags.length">{{ story.tags.length }} 个标签</span>
              </div>
              <div v-if="story.aiSummary" class="spread-pullquote">"{{ truncate(story.aiSummary, 80) }}"</div>
              <div v-if="story.tags && story.tags.length" class="spread-tags">
                <span v-for="tag in story.tags.slice(0, 5)" :key="tag.id" class="spread-tag">{{ tag.name }}</span>
              </div>
              <span class="spread-cta">查看完整故事 →</span>
            </div>
          </div>
        </div>

        <div v-if="hasMore" class="load-more">
          <button @click="loadMore" :disabled="loading">
            {{ loading ? '加载中...' : '加载更多故事' }}
          </button>
        </div>
        <div v-else-if="stories.length > 0" class="all-loaded">
          <p>共 {{ total }} 个故事</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.storyline-page {
  min-height: calc(100vh - 140px);
  padding-bottom: 64px;
}

.page-header {
  text-align: center;
  padding: 40px 0 8px;
}

.page-header h1 {
  font-size: 2.4rem;
  font-weight: 800;
  color: #000;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.section-sub {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 36px;
}

/* Year strip */
.year-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.issue-label {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-right: 6px;
}

.year-strip button {
  padding: 6px 22px;
  border-radius: 20px;
  border: 1px solid var(--n-300);
  background: transparent;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.year-strip button.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

.year-strip button:hover:not(.active) {
  border-color: #000;
  color: #000;
}

/* Spreads */
.spreads {
  max-width: 960px;
  margin: 0 auto;
}

.spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 36px;
  background: var(--card-bg);
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.25s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.spread:hover {
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}

.spread.reverse .spread-img {
  order: 1;
}

.spread.reverse .spread-text {
  order: 0;
}

.spread-img {
  position: relative;
  overflow: hidden;
  min-height: 320px;
  background: var(--n-200);
}

.spread-img img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}

.spread:hover .spread-img img {
  transform: scale(1.04);
}

.img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 1.2rem;
  position: absolute;
  inset: 0;
}

.spread-text {
  padding: 36px 36px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.spread-date {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  font-feature-settings: "tnum";
}

.spread-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 6px;
  color: #000;
  line-height: 1.3;
}

:root.dark .spread-title {
  color: #e0e0e0;
}

.spread-meta {
  display: flex;
  gap: 14px;
  font-size: 0.78rem;
  color: var(--text-tertiary);
  margin-bottom: 18px;
}

.spread-pullquote {
  font-size: 0.95rem;
  font-style: italic;
  color: var(--text-secondary);
  line-height: 1.7;
  border-left: 3px solid #000;
  padding-left: 18px;
  margin-bottom: 16px;
}

:root.dark .spread-pullquote {
  border-left-color: #888;
}

.spread-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.spread-tag {
  font-size: 0.7rem;
  color: var(--text-secondary);
  border: 1px solid var(--n-300);
  padding: 2px 10px;
  border-radius: 10px;
}

.spread-cta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.84rem;
  font-weight: 600;
  color: #000;
  border-bottom: 2px solid #000;
  padding-bottom: 2px;
  align-self: flex-start;
  transition: gap 0.2s;
}

:root.dark .spread-cta {
  color: #e0e0e0;
  border-bottom-color: #e0e0e0;
}

.spread:hover .spread-cta {
  gap: 8px;
}

/* States */
.loading-state, .empty-state {
  text-align: center;
  padding: 72px 20px;
  color: var(--text-tertiary);
}

.loading-state p, .empty-state p {
  margin-top: 14px;
  font-size: 0.95rem;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--n-300);
  border-top-color: #000;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.link-btn {
  display: inline-block;
  margin-top: 12px;
  color: #000;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.92rem;
}
.link-btn:hover { text-decoration: underline; }

.empty-state button {
  margin-top: 14px;
  padding: 8px 24px;
  border: none;
  background: #000;
  color: white;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.88rem;
}

/* Load more */
.load-more {
  text-align: center;
  padding: 24px 0 12px;
}

.load-more button {
  padding: 10px 32px;
  border: 1px solid var(--n-300);
  border-radius: 24px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.load-more button:hover:not(:disabled) {
  border-color: #000;
  color: #000;
}

.all-loaded {
  text-align: center;
  padding: 16px 0;
  color: var(--text-tertiary);
  font-size: 0.84rem;
}

@media (max-width: 720px) {
  .spread {
    grid-template-columns: 1fr;
  }
  .spread.reverse .spread-img {
    order: 0;
  }
  .spread.reverse .spread-text {
    order: 1;
  }
  .spread-img {
    min-height: 200px;
  }
  .spread-text {
    padding: 24px;
  }
  .spread-title {
    font-size: 1.2rem;
  }
  .page-header h1 {
    font-size: 1.8rem;
  }
}
</style>
