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

const coverPhoto = computed(() => photos.value[0] || null)

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

const generateAiSummary = async () => {
  aiLoading.value = true
  aiError.value = null
  try {
    const photoIds = photos.value.length > 0 ? photos.value.map(p => p.id) : []
    const res = await storylines.generateSummary(
      date.value,
      location.value,
      photoIds.length > 0 ? { photoIds } : undefined
    )
    if (res.summary && res.summary.trim().length > 0) {
      aiSummary.value = res.summary
    } else if (res.error) {
      aiError.value = { message: res.error.message || '生成失败' }
    } else {
      // 后端返回了空内容但没有错误信息
      aiError.value = { message: 'AI 返回内容为空，请稍后重试' }
    }
  } catch (e) {
    console.error('AI 叙事生成失败:', e)
    aiError.value = { message: e.response?.data?.error?.message || e.message || '网络请求失败，请检查连接' }
  } finally {
    aiLoading.value = false
  }
}

const formatFullDate = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const goBack = () => {
  router.push({ name: 'Storyline' })
}

onMounted(loadDetail)
</script>

<template>
  <div class="story-detail-page">
    <div v-if="loading" class="loading-screen">
      <div class="spinner"></div>
      <p>正在打开故事...</p>
    </div>

    <div v-else-if="!detail" class="not-found">
      <p>故事不存在或已被删除</p>
      <button @click="goBack">返回故事线</button>
    </div>

    <template v-else>
      <section class="hero-section">
        <div
          class="hero-bg"
          :style="coverPhoto ? { backgroundImage: `url(${coverPhoto.original_url || coverPhoto.url || coverPhoto.thumbnail_url})` } : {}"
        ></div>
        <button class="back-btn" @click="goBack">← 返回</button>
        <div class="hero-label">
          <h1>{{ formatFullDate(detail.date) }}</h1>
          <p class="hero-location">{{ detail.location }}</p>
          <div class="hero-meta">
            <span>{{ photos.length }} 张照片</span>
            <span v-if="tags.length">{{ tags.length }} 个标签</span>
          </div>
          <div v-if="tags.length" class="hero-tags">
            <span v-for="tag in tags" :key="tag.id" class="hero-tag">{{ tag.name }}</span>
          </div>
        </div>
      </section>

      <div class="content-area">
        <div class="content-main">
          <section class="ai-block">
            <h2>AI 叙事</h2>
            <div v-if="aiLoading" class="ai-loading">
              <div class="mini-spinner"></div>
              <p>AI 正在回忆这段故事...</p>
            </div>
            <p v-else-if="aiSummary" class="ai-text">{{ aiSummary }}</p>
            <div v-else class="ai-prompt">
              <button @click="generateAiSummary" :disabled="aiLoading">
                让 AI 讲述这个故事
              </button>
            </div>
            <p v-if="aiError" class="ai-error">{{ aiError.message || '生成失败' }}</p>
          </section>

          <section class="photos-block">
            <h2>全部照片</h2>
            <div class="photo-grid">
              <figure v-for="photo in photos" :key="photo.id" class="photo-item">
                <img :src="photo.thumbnail_url || photo.url" :alt="photo.title || ''" loading="lazy" />
                <figcaption v-if="photo.title">
                  <span class="photo-title">{{ photo.title }}</span>
                  <span v-if="photo.mood" class="photo-mood">{{ photo.mood }}</span>
                </figcaption>
              </figure>
            </div>
          </section>
        </div>

        <aside class="content-sidebar">
          <div class="exif-card" v-if="coverPhoto">
            <h3>照片信息</h3>
            <dl>
              <div class="exif-row">
                <dt>相机</dt>
                <dd>{{ coverPhoto.camera || '--' }}</dd>
              </div>
              <div class="exif-row">
                <dt>镜头</dt>
                <dd>{{ coverPhoto.lens || '--' }}</dd>
              </div>
              <div class="exif-row">
                <dt>光圈</dt>
                <dd>{{ coverPhoto.aperture || '--' }}</dd>
              </div>
              <div class="exif-row">
                <dt>快门</dt>
                <dd>{{ coverPhoto.shutter_speed || '--' }}</dd>
              </div>
              <div class="exif-row">
                <dt>ISO</dt>
                <dd>{{ coverPhoto.iso || '--' }}</dd>
              </div>
            </dl>
          </div>

          <div class="action-card">
            <router-link
              :to="{ path: '/share/create', query: { date: detail.date, location: detail.location } }"
              class="action-btn primary"
            >
              生成分享卡片
            </router-link>
            <button class="action-btn ghost" @click="goBack">返回故事线</button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.story-detail-page {
  min-height: calc(100vh - 100px);
}

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

.spinner { width: 40px; height: 40px; border: 3px solid var(--n-300); border-top-color: #000; }
.mini-spinner { width: 22px; height: 22px; border: 2px solid var(--n-300); border-top-color: #000; }

@keyframes spin { to { transform: rotate(360deg); } }

.not-found button {
  margin-top: 14px;
  padding: 8px 24px;
  border: none;
  background: #000;
  color: white;
  border-radius: 20px;
  cursor: pointer;
}

/* Hero */
.hero-section {
  position: relative;
  height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  max-width: 960px;
  margin: 0 auto;
  border-radius: 4px;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-color: var(--n-200);
}

.back-btn {
  position: absolute;
  top: 20px;
  left: 24px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: none;
  color: #000;
  padding: 6px 16px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 500;
  z-index: 2;
  transition: background 0.2s;
}

.back-btn:hover {
  background: #fff;
}

.hero-label {
  position: relative;
  z-index: 1;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  margin: 0;
  padding: 20px 32px;
  border-radius: 12px;
  text-align: center;
  color: #fff;
}

.hero-label h1 {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: #fff;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

.hero-location {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.7);
  margin-bottom: 8px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

.hero-meta {
  display: flex;
  gap: 12px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.5);
  margin-bottom: 8px;
  justify-content: center;
}

.hero-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.hero-tag {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.2);
  padding: 2px 10px;
  border-radius: 10px;
}

/* Content area */
.content-area {
  max-width: 1100px;
  margin: 0 auto;
  padding: 36px 24px 48px;
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 40px;
}

/* Main column */
.content-main section {
  margin-bottom: 36px;
}

.content-main h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: #000;
  padding-bottom: 8px;
  border-bottom: 2px solid #000;
  display: inline-block;
}

:root.dark .content-main h2 {
  color: #e0e0e0;
  border-bottom-color: #555;
}

/* AI block */
.ai-block {
  background: var(--n-200);
  border-radius: 4px;
  padding: 24px;
}

.ai-loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 12px;
}

.ai-loading p {
  margin-top: 8px;
  font-size: 0.9rem;
}

.ai-text {
  font-size: 0.95rem;
  line-height: 1.85;
  color: var(--text-color);
  white-space: pre-wrap;
}

.ai-prompt {
  text-align: center;
  padding: 8px 0;
}

.ai-prompt button {
  background: #000;
  border: none;
  color: white;
  padding: 10px 24px;
  border-radius: 24px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ai-prompt button:hover {
  opacity: 0.85;
}

.ai-error {
  color: var(--text-secondary);
  font-size: 0.84rem;
  margin-top: 8px;
}

/* Photo grid */
.photo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.photo-item {
  break-inside: avoid;
  margin: 0;
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 2px;
  overflow: hidden;
}

.photo-item img {
  width: 100%;
  display: block;
  transition: transform 0.3s;
}

.photo-item:hover img {
  transform: scale(1.02);
}

.photo-item figcaption {
  padding: 8px 10px;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.photo-title {
  display: block;
  color: var(--text-color);
  font-weight: 500;
  margin-bottom: 2px;
}

.photo-mood {
  font-style: italic;
  opacity: 0.7;
  font-size: 0.78rem;
}

/* Sidebar */
.content-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.exif-card {
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 4px;
  padding: 20px;
}

.exif-card h3 {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.exif-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--n-200);
}

.exif-row:last-child {
  border-bottom: none;
}

.exif-row dt {
  font-size: 0.78rem;
  color: var(--text-tertiary);
}

.exif-row dd {
  font-size: 0.78rem;
  color: var(--text-color);
  font-weight: 500;
  margin: 0;
  text-align: right;
}

/* Action buttons */
.action-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: block;
  text-align: center;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  border: none;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #000;
  color: white;
}

.action-btn.primary:hover {
  opacity: 0.85;
}

.action-btn.ghost {
  background: transparent;
  border: 1px solid var(--n-300);
  color: var(--text-secondary);
}

.action-btn.ghost:hover {
  border-color: #000;
  color: #000;
}

@media (max-width: 768px) {
  .content-area {
    grid-template-columns: 1fr;
  }

  .hero-section {
    height: 320px;
  }

  .hero-label {
    margin: 0 16px 20px;
    padding: 16px 20px;
  }

  .photo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
