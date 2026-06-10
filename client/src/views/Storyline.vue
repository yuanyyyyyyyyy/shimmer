<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storylines } from '../api'
import StoryCard from '../components/StoryCard.vue'

const router = useRouter()
const stories = ref([])
const years = ref([])
const selectedYear = ref(null)
const loading = ref(true)
const error = ref(null)
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => stories.value.length < total.value)

// 加载可用年份
const loadYears = async () => {
  try {
    const reviewData = await import('../api')
    const res = await reviewData.photos.getReviewYears()
    years.value = res.years || []
    // 默认选最新年份
    if (years.value.length > 0 && !selectedYear.value) {
      selectedYear.value = years.value[0]
    }
  } catch (e) {
    console.error(e)
  }
}

// 加载故事列表
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

// 加载更多
const loadMore = () => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadStories()
}

// 切换年份
const changeYear = (year) => {
  selectedYear.value = year
  loadStories(true)
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
      <!-- 头部 -->
      <header class="page-header">
        <h1>我的光影故事</h1>
        <p class="subtitle">每一段旅程，都值得被讲述</p>
      </header>

      <!-- 年份筛选 -->
      <div v-if="years.length > 0" class="year-filter">
        <button
          v-for="y in years"
          :key="y"
          :class="{ active: selectedYear === y }"
          @click="changeYear(y)"
        >
          {{ y }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading && stories.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>正在编织你的光影故事...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error && stories.length === 0" class="empty-state">
        <p>{{ error }}</p>
        <button @click="loadStories(true)">重试</button>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && stories.length === 0" class="empty-state">
        <p>{{ selectedYear ? `${selectedYear} 年还没有照片` : '还没有任何故事' }}</p>
        <router-link to="/" class="link-btn">去上传一些照片吧</router-link>
      </div>

      <!-- 故事卡片流 -->
      <template v-else>
        <div class="story-list">
          <StoryCard
            v-for="(story, idx) in stories"
            :key="`${story.date}-${story.location}-${idx}`"
            :story="story"
          />
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="load-more">
          <button @click="loadMore" :disabled="loading">
            {{ loading ? '加载中...' : '加载更多故事' }}
          </button>
        </div>
        <div v-else-if="stories.length > 0" class="all-loaded">
          <p>已经到底了 — 共 {{ stories.value?.length || stories.length }} 个故事</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.storyline-page {
  min-height: calc(100vh - 140px);
  padding-bottom: 48px;
}

.page-header {
  text-align: center;
  padding: 36px 0 28px;
}

.page-header h1 {
  font-size: 1.9rem;
  font-weight: 800;
  background: linear-gradient(135deg, oklch(45% 0.16 75), oklch(38% 0.12 250));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* 年份筛选器 */
.year-filter {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.year-filter button {
  background: var(--input-bg);
  border: 1px solid transparent;
  padding: 8px 22px;
  border-radius: 22px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.22s ease;
}

.year-filter button.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 3px 12px oklch(55% 0.16 75 / 30%);
  transform: scale(1.03);
}

.year-filter button:hover:not(.active) {
  border-color: oklch(55% 0.12 75 / 25%);
  color: var(--text-primary);
}

/* 故事列表 */
.story-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 720px;
  margin: 0 auto;
}

/* 状态提示 */
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
  border: 3px solid oklch(94% 0.008 75);
  border-top-color: var(--color-primary);
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
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.92rem;
}
.link-btn:hover { text-decoration: underline; }

.empty-state button, .loading-state button {
  margin-top: 14px;
  padding: 8px 24px;
  border: none;
  background: var(--color-primary);
  color: white;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.88rem;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 28px 0 12px;
}

.load-more button {
  padding: 10px 32px;
  border: 1px solid oklch(88% 0.02 75);
  border-radius: 24px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.load-more button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.all-loaded {
  text-align: center;
  padding: 20px 0;
  color: var(--text-tertiary);
  font-size: 0.84rem;
}
</style>
