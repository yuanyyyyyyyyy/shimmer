<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storylines, share } from '../api'

const route = useRoute()
const router = useRouter()
const detail = ref(null)
const photos = ref([])
const tags = ref([])
const loading = ref(true)
const aiSummary = ref('')
const aiLoading = ref(false)
const aiError = ref(null)

const date = computed(() => route.params.date)
const location = computed(() => decodeURIComponent(route.params.location))

// 加载故事详情
const loadDetail = async () => {
  loading.value = true
  try {
    const res = await storylines.getDetail(date.value, location.value)
    detail.value = res
    photos.value = res.photos || []
    tags.value = res.tags || []
    aiSummary.value = ''
  } catch (e) {
    console.error('加载失败:', e)
    if (e.response?.status === 404) {
      detail.value = null
    }
  } finally {
    loading.value = false
  }
}

// 生成 AI 叙事
const generateAiSummary = async () => {
  aiLoading.value = true
  aiError.value = null
  try {
    // 提取已有照片 ID 作为兜底参数
    const photoIds = photos.value.length > 0 ? photos.value.map(p => p.id) : []
    const res = await storylines.generateSummary(
      date.value, 
      location.value,
      photoIds.length > 0 ? { photoIds } : undefined
    )
    if (res.summary) {
      aiSummary.value = res.summary
    } else if (res.error) {
      aiError.value = res.error
    }
  } catch (e) {
    aiError.value = { message: e.message }
  } finally {
    aiLoading.value = false
  }
}

// 格式化日期
const formatFullDate = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${['日','一','二','三','四','五','六'][date.getDay()]}`
}

// 返回故事线
const goBack = () => {
  router.push({ name: 'Storyline' })
}

onMounted(loadDetail)
</script>

<template>
  <div class="story-detail-page">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-screen">
      <div class="spinner"></div>
      <p>正在打开故事...</p>
    </div>

    <!-- 不存在 -->
    <div v-else-if="!detail" class="not-found">
      <p>故事不存在或已被删除</p>
      <button @click="goBack">返回故事线</button>
    </div>

    <!-- 故事内容 -->
    <template v-else>
      <!-- Hero 封面 -->
      <section class="hero-section" :style="{ backgroundImage: photos[0] ? `url(${photos[0].url || photos[0].thumbnail_url})` : 'none' }">
        <div class="hero-overlay"></div>
        <div class="hero-content container">
          <button class="back-btn" @click="goBack">← 返回故事线</button>
          <h1>{{ formatFullDate(detail.date) }}</h1>
          <div class="location-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {{ detail.location }}
          </div>
          <div class="meta-info">
            <span>{{ photos.length }} 张照片</span>
            <span v-if="tags.length > 0">{{ tags.length }} 个标签</span>
          </div>
        </div>
      </section>

      <div class="container content-area">
        <!-- AI 叙事摘要 -->
        <section class="summary-block" v-if="aiSummary || aiLoading || !aiSummary">
          <h2>AI 故事叙述</h2>
          <div v-if="aiLoading" class="ai-loading">
            <div class="mini-spinner"></div>
            <p>AI 正在回忆这段故事...</p>
          </div>
          <p v-else-if="aiSummary" class="ai-text">{{ aiSummary }}</p>
          <div v-else class="ai-prompt">
            <button @click="generateAiSummary" :disabled="aiLoading">
              让 AI 讲述这个故事 ✨
            </button>
          </div>
          <p v-if="aiError" class="ai-error">{{ aiError.message || '生成失败' }}</p>
        </section>

        <!-- 标签云 -->
        <section v-if="tags.length > 0" class="tags-block">
          <h2>故事标签</h2>
          <div class="tag-cloud">
            <span
              v-for="tag in tags"
              :key="tag.id"
              class="cloud-tag"
              :style="{ backgroundColor: tag.color || 'var(--color-primary)' }"
            >
              {{ tag.name }}
            </span>
          </div>
        </section>

        <!-- 照片瀑布流 -->
        <section class="photos-block">
          <h2>全部照片</h2>
          <div class="masonry">
            <figure v-for="photo in photos" :key="photo.id" class="masonry-item">
              <img :src="photo.thumbnail_url || photo.url" :alt="photo.title || ''" loading="lazy" />
              <figcaption v-if="photo.title || photo.mood">
                <strong v-if="photo.title">{{ photo.title }}</strong>
                <span v-if="photo.mood" class="mood-text">{{ photo.mood }}</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <!-- 底部操作栏 -->
        <div class="bottom-actions">
          <router-link to="/share/create" class="action-btn primary" :query="{ date: detail.date, location: detail.location }">
            生成分享卡片
          </router-link>
          <button class="action-btn ghost" @click="goBack">返回故事线</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.story-detail-page {
  min-height: calc(100vh - 100px);
}

/* 加载 / 错误 */
.loading-screen, .not-found {
  text-align: center;
  padding: 100px 20px;
  color: var(--text-tertiary);
}

.spinner, .mini-spinner {
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 0 auto 16px;
}
.spinner { width: 40px; height: 40px; border: 3px solid oklch(94% 0.008 75); border-top-color: var(--color-primary); }
.mini-spinner { width: 22px; height: 22px; border: 2px solid oklch(94% 0.008 75); border-top-color: var(--color-primary); }

@keyframes spin { to { transform: rotate(360deg); } }

.not-found button {
  margin-top: 14px;
  padding: 8px 24px;
  border: none;
  background: var(--color-primary);
  color: white;
  border-radius: 20px;
  cursor: pointer;
}

/* Hero 区域 */
.hero-section {
  position: relative;
  height: 380px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.05),
    rgba(0, 0, 0, 0.45) 70%,
    rgba(0, 0, 0, 0.72)
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  padding-bottom: 32px;
  color: white;
}

.back-btn {
  position: absolute;
  top: -300px;
  left: 0;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  padding: 8px 18px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.86rem;
  transition: background 0.2s;
}
.back-btn:hover { background: rgba(255, 255, 255, 0.28); }

.hero-content h1 {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 10px;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.location-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  opacity: 0.92;
  margin-bottom: 10px;
}

.meta-info {
  display: flex;
  gap: 16px;
  font-size: 0.86rem;
  opacity: 0.78;
}

.content-area {
  padding-top: 32px;
}

/* 区块通用样式 */
.content-area section {
  margin-bottom: 36px;
}

.content-area h2 {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-primary);
  padding-bottom: 10px;
  border-bottom: 2px solid oklch(94% 0.008 75);
}

/* AI 摘要 */
.summary-block {
  background: linear-gradient(135deg, oklch(97% 0.015 75), oklch(96% 0.01 250));
  border: 1px solid oklch(88% 0.02 75);
  border-radius: 16px;
  padding: 24px;
}

.ai-loading { text-align: center; color: var(--text-secondary); padding: 12px; }
.ai-loading p { margin-top: 8px; font-size: 0.9rem; }

.ai-text {
  font-size: 1rem;
  line-height: 1.85;
  color: oklch(33% 0.015 75);
  white-space: pre-wrap;
}

.ai-prompt { text-align: center; padding: 8px 0; }

.ai-prompt button {
  background: linear-gradient(135deg, var(--color-primary), oklch(48% 0.14 75));
  border: none;
  color: white;
  padding: 12px 28px;
  border-radius: 26px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s, transform 0.2s;
}
.ai-prompt button:hover { filter: brightness(1.06); transform: scale(1.02); }

.ai-error { color: oklch(55% 0.18 25); font-size: 0.88rem; margin-top: 8px; }

/* 标签云 */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cloud-tag {
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 0.86rem;
  color: white;
}

/* 瀑布流 */
.masonry {
  columns: 3;
  column-gap: 12px;
}

@media (max-width: 768px) {
  .masonry { columns: 2; }
}
@media (max-width: 480px) {
  .masonry { columns: 1; }
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 12px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.masonry-item img {
  width: 100%;
  display: block;
  transition: transform 0.3s;
}

.masonry-item:hover img { transform: scale(1.02); }

.masonry-item figcaption {
  padding: 10px 12px;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.masonry-item strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 3px;
}

.mood-text {
  font-style: italic;
  opacity: 0.75;
}

/* 底部操作 */
.bottom-actions {
  display: flex;
  justify-content: center;
  gap: 14px;
  padding: 28px 0 48px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 11px 28px;
  border-radius: 24px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
}

.action-btn.primary {
  background: var(--color-primary);
  color: white;
}
.action-btn.primary:hover { filter: brightness(1.07); }

.action-btn.ghost {
  background: oklch(94% 0.008 75);
  color: var(--text-secondary);
}
.action-btn.ghost:hover { background: oklch(90% 0.01 75); }
</style>
