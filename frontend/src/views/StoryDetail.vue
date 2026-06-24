<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storylines } from '../api'
import Lightbox from '../components/Lightbox.vue'

const route = useRoute()
const router = useRouter()
const detail = ref(null)
const photos = ref([])
const tags = ref([])
const loading = ref(true)
const aiSummary = ref('')
const aiLoading = ref(false)
const aiError = ref(null)
const aiOutdated = ref(false)

const date = computed(() => route.params.date)
const location = computed(() => decodeURIComponent(route.params.location))

const coverPhoto = computed(() => photos.value[0] || null)

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

const viewPhoto = (index) => {
  lightboxIndex.value = index
  lightboxVisible.value = true
}

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await storylines.getDetail(date.value, location.value)
    detail.value = res
    photos.value = res.photos || []
    tags.value = res.tags || []
    // 如果后端已缓存了 AI 叙事，直接填充
    aiSummary.value = res.aiSummary || ''
    aiOutdated.value = !!res.aiSummaryOutdated
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
      { photoIds, regenerate: true }
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
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`
}

const goBack = () => {
  router.push({ name: 'Storyline' })
}

onMounted(async () => {
  await loadDetail()
  // 照片变化导致叙事过期时，自动重新生成
  if (aiOutdated.value && !aiSummary.value) {
    generateAiSummary()
  }
})
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
      <div class="detail-header">
        <button class="back-btn" @click="goBack">← 返回</button>
      </div>
      <section class="hero-section">
        <div class="hero-frame">
          <div
            class="hero-bg"
            :style="coverPhoto ? { backgroundImage: `url(${coverPhoto.original_url || coverPhoto.url || coverPhoto.thumbnail_url})` } : {}"
          ></div>
          <div class="hero-label">
            <span class="hero-date">{{ formatFullDate(detail.date) }}</span>
            <span class="hero-dot"></span>
            <span class="hero-location">{{ detail.location }}</span>
          </div>
        </div>
      </section>

      <div class="content-area">
        <div v-if="tags.length" class="story-tags">
          <span v-for="tag in tags" :key="tag.id" class="story-tag">{{ tag.name }}</span>
        </div>

        <section class="story-narrative">
          <h2 class="narrative-label">AI 叙事</h2>
          <div v-if="aiLoading" class="ai-loading">
            <div class="mini-spinner"></div>
            <p>AI 正在回忆这段故事...</p>
          </div>
          <template v-else>
            <p v-if="aiSummary" class="narrative-text">{{ aiSummary }}</p>
            <div class="ai-prompt">
              <button @click="generateAiSummary" class="narrative-btn">
                {{ aiSummary ? '重新生成叙事' : '让 AI 讲述这个故事' }}
              </button>
            </div>
          </template>
          <p v-if="aiError" class="ai-error">{{ aiError.message || '生成失败' }}</p>
        </section>

        <div class="story-exif" v-if="coverPhoto">
          <span v-if="coverPhoto.camera">{{ coverPhoto.camera }}</span>
          <span class="exif-sep"></span>
          <span v-if="coverPhoto.lens">{{ coverPhoto.lens }}</span>
          <span class="exif-sep"></span>
          <span v-if="coverPhoto.aperture">{{ coverPhoto.aperture }}</span>
          <span class="exif-sep"></span>
          <span v-if="coverPhoto.shutter_speed">{{ coverPhoto.shutter_speed }}</span>
          <span class="exif-sep"></span>
          <span v-if="coverPhoto.iso">ISO {{ coverPhoto.iso }}</span>
        </div>

        <div class="story-actions">
          <router-link
            :to="{ path: '/share/create', query: { date: detail.date, location: detail.location, photoIds: photos.map(p => p.id).join(',') } }"
            class="action-btn primary"
          >
            生成分享卡片
          </router-link>
          <button class="action-btn ghost" @click="goBack">返回故事线</button>
        </div>

        <section class="photos-block">
          <h2 class="photos-heading">全部照片</h2>
          <div class="photo-strip">
              <figure v-for="(photo, index) in photos" :key="photo.id" class="photo-item" @click="viewPhoto(index)">
                <div class="photo-img">
                  <img :src="photo.original_url || photo.url || photo.thumbnail_url" :alt="photo.title || ''" loading="lazy" />
                </div>
                <figcaption v-if="photo.title || photo.mood" class="photo-caption">
                <span v-if="photo.title" class="photo-title">{{ photo.title }}</span>
                <span v-if="photo.mood" class="photo-mood">{{ photo.mood }}</span>
              </figcaption>
            </figure>
          </div>
        </section>
      </div>
    </template>

    <Lightbox
      :photos="photos"
      :start-index="lightboxIndex"
      :visible="lightboxVisible"
      @close="lightboxVisible = false"
    />
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

/* ===== Detail Header (back button) ===== */
.detail-header {
  max-width: 640px;
  margin: 0 auto;
  padding: 20px 24px 0;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-s);
  padding: 6px 0;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 500;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #000;
}

/* ===== Hero ===== */
.hero-section {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px 24px 0;
  display: flex;
  justify-content: center;
}

.hero-frame {
  position: relative;
  width: 592px;
  aspect-ratio: 8/3;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--n-200);
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.hero-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 1;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 6px 14px;
  border-radius: 6px;
  color: #fff;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hero-date {
  font-weight: 600;
}

.hero-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
}

.hero-location {
  font-weight: 400;
  opacity: 0.7;
}

/* ===== Content area (single column) ===== */
.content-area {
  max-width: 640px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

/* ===== Tags ===== */
.story-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.story-tag {
  font-size: 0.72rem;
  color: var(--text-s);
  border: 1px solid var(--border-light);
  padding: 3px 12px;
  border-radius: 12px;
}

/* ===== Narrative ===== */
.story-narrative {
  margin-bottom: 32px;
}

.narrative-label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-t);
  margin-bottom: 16px;
}

.narrative-text {
  font-size: 1rem;
  line-height: 1.9;
  color: var(--text-p);
  white-space: pre-wrap;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

.ai-loading {
  text-align: center;
  color: var(--text-s);
  padding: 12px;
}

.ai-loading p {
  margin-top: 8px;
  font-size: 0.9rem;
}

.ai-prompt {
  text-align: left;
  padding: 4px 0;
}

.narrative-btn {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-s);
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 0.84rem;
  cursor: pointer;
  transition: all 0.2s;
}

.narrative-btn:hover {
  border-color: #000;
  color: #000;
}

.ai-error {
  color: var(--text-t);
  font-size: 0.84rem;
  margin-top: 8px;
}

/* ===== EXIF bar ===== */
.story-exif {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-t);
  padding: 14px 0;
  border-top: 1px solid var(--border-divider);
  border-bottom: 1px solid var(--border-divider);
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.exif-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--border-light);
}

/* ===== Actions ===== */
.story-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 48px;
}

.action-btn {
  display: inline-block;
  text-align: center;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 500;
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
  border: 1px solid var(--border-light);
  color: var(--text-s);
}

.action-btn.ghost:hover {
  border-color: #000;
  color: #000;
}

/* ===== Photos ===== */
.photos-block {
  margin-bottom: 36px;
}

.photos-heading {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-t);
  margin-bottom: 20px;
}

.photo-strip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.photo-item {
  margin: 0;
  overflow: hidden;
  cursor: pointer;
}

.photo-item .photo-img {
  width: 100%;
  aspect-ratio: 1/1;
  overflow: hidden;
}

.photo-item img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transition: transform 0.3s;
}

.photo-item:hover img {
  transform: scale(1.01);
}

.photo-caption {
  padding: 10px 4px 0;
  font-size: 0.82rem;
  color: var(--text-s);
}

.photo-title {
  display: block;
  color: var(--text-p);
  font-weight: 500;
  margin-bottom: 2px;
}

.photo-mood {
  font-style: italic;
  opacity: 0.6;
  font-size: 0.78rem;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .detail-header {
    padding: 16px 16px 0;
  }

  .hero-section {
    padding: 12px 16px 0;
  }

  .hero-frame {
    width: min(280px, 100%);
  }

  .hero-label {
    font-size: 0.72rem;
    padding: 5px 10px;
    bottom: 8px;
    left: 8px;
  }

  .content-area {
    padding: 28px 16px 48px;
  }

  .story-actions {
    flex-direction: column;
  }

  .photo-strip {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
</style>
