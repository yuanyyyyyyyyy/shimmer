<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  story: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const expanded = ref(false)
const summaryLoading = ref(false)
const aiSummaryText = ref(props.story.aiSummary || '')
const errorMsg = ref('')

// 将日期规范化为 YYYY-MM-DD 格式（兼容 ISO 字符串、JS Date 对象、已有 DATE 字符串）
const normalizeDate = (dateVal) => {
  if (!dateVal) return ''
  const s = typeof dateVal === 'string' ? dateVal : String(dateVal)
  // 已是纯日期格式 "2025-03-21"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // ISO 格式 "2025-03-21T..." — 取前10位
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // 尝试 Date 解析
  const d = new Date(dateVal)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return s
}

// 切换 AI 摘要展开/收起
const toggleExpand = () => {
  expanded.value = !expanded.value
}

// 生成/重新生成 AI 摘要
const generateSummary = async () => {
  if (summaryLoading.value) return
  summaryLoading.value = true
  errorMsg.value = ''
  try {
    const { storylines } = await import('../api')
    // 提取已有照片 ID 作为兜底参数（后端可用 ID 直查绕过 location 匹配问题）
    const photoIds = props.story.photos?.map(p => p.id) || []
    const res = await storylines.generateSummary(
      normalizeDate(props.story.date), 
      props.story.location,
      photoIds.length > 0 ? { photoIds } : undefined
    )
    if (res.summary) {
      aiSummaryText.value = res.summary
    } else if (res.error) {
      const msg = res.error.message || res.error.code || 'AI 服务暂不可用'
      errorMsg.value = `生成失败：${msg}`
      console.error('[StoryCard] AI 摘要生成失败:', res.error)
    } else {
      errorMsg.value = '生成失败：未返回摘要内容'
    }
  } catch (e) {
    errorMsg.value = `请求异常：${e.message || '网络错误'}`
    console.error('[StoryCard] 生成摘要异常:', e)
  } finally {
    summaryLoading.value = false
  }
}

// 跳转到详情页
const goDetail = () => {
  router.push({
    name: 'StoryDetail',
    params: {
      date: normalizeDate(props.story.date),
      location: encodeURIComponent(props.story.location)
    }
  })
}

// 格式化日期（兼容 MySQL DATE 字符串 "2025-06-09" 和 JS Date 对象）
const formatDate = (dateStr) => {
  if (!dateStr) return '未知日期'
  let d
  if (typeof dateStr === 'string') {
    // 处理 "2025-06-09" 格式，避免时区偏移
    const parts = dateStr.split(/[-T\s]/)
    d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
  } else {
    d = new Date(dateStr)
  }
  if (isNaN(d.getTime())) return String(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
}
</script>

<template>
  <article class="story-card" @click="goDetail">
    <div class="story-timeline">
      <div class="timeline-dot"></div>
      <div class="timeline-line"></div>
    </div>

    <div class="story-content">
      <!-- 标题行 -->
      <div class="story-header">
        <div class="story-date">{{ formatDate(story.date) }}</div>
        <div class="story-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {{ story.location }}
        </div>
        <div class="photo-count">{{ story.photoCount }} 张</div>
      </div>

      <!-- 照片缩略图网格 -->
      <div class="photos-grid" v-if="story.photos && story.photos.length > 0">
        <div
          v-for="photo in story.photos.slice(0, 4)"
          :key="photo.id"
          class="thumb"
          :class="{ 'single': story.photos.length === 1, 'double': story.photos.length === 2 }"
        >
          <img :src="photo.thumbnail_url || photo.url" :alt="photo.title || '照片'" loading="lazy" />
        </div>
        <div v-if="story.photos.length > 4" class="thumb more">
          <span>+{{ story.photos.length - 4 }}</span>
        </div>
      </div>

      <!-- AI 叙事摘要（可展开） -->
      <div class="ai-summary" v-if="aiSummaryText">
        <p :class="{ collapsed: !expanded }">{{ aiSummaryText }}</p>
        <button
          v-if="aiSummaryText && aiSummaryText.length > 60"
          class="toggle-btn"
          @click.stop="toggleExpand"
        >
          {{ expanded ? '收起' : '展开全文' }}
        </button>
      </div>
      <!-- 错误提示 -->
      <div class="ai-error" v-else-if="errorMsg && !summaryLoading">
        <p>{{ errorMsg }}</p>
        <button class="retry-btn" @click.stop="generateSummary">重试</button>
      </div>
      <!-- 生成按钮 / 加载态 -->
      <button
        v-else
        class="generate-btn"
        :class="{ loading: summaryLoading }"
        @click.stop="generateSummary"
      >
        {{ summaryLoading ? '生成中...' : 'AI 讲述这个故事' }}
      </button>

      <!-- 标签栏 -->
      <div class="tags-row" v-if="story.tags && story.tags.length > 0">
        <span
          v-for="tag in story.tags.slice(0, 5)"
          :key="tag.id"
          class="tag-pill"
          :style="{ backgroundColor: tag.color || '#000' }"
        >
          {{ tag.name }}
        </span>
      </div>

      <!-- 操作按钮组 -->
      <div class="actions">
        <button class="action-btn primary" @click.stop="goDetail">
          查看完整故事 →
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.story-card {
  display: flex;
  gap: 20px;
  padding: 20px;
  border-radius: 16px;
  background: var(--card-bg);
  box-shadow: 0 2px 12px var(--shadow-color);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}

.story-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

/* 时间线 */
.story-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  padding-top: 6px;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #000;
  flex-shrink: 0;
  box-shadow: 0 0 0 4px var(--n-300);
}

.timeline-line {
  width: 2px;
  flex: 1;
  min-height: 40px;
  margin-top: 8px;
  background: linear-gradient(to bottom, var(--n-300), transparent);
}

/* 内容区 */
.story-content {
  flex: 1;
  min-width: 0;
}

.story-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.story-date {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.story-location {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.88rem;
  color: var(--text-secondary);
  opacity: 0.85;
}

.photo-count {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  background: var(--n-200);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
}

/* 照片网格 */
.photos-grid {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
  grid-template-columns: repeat(4, 1fr);
  border-radius: 10px;
  overflow: hidden;
}

.photos-grid.single {
  grid-template-columns: 1fr;
  max-width: 280px;
}

.photos-grid.double {
  grid-template-columns: repeat(2, 1fr);
}

.thumb {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 6px;
  background: var(--n-200);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.story-card:hover .thumb img {
  transform: scale(1.05);
}

.thumb.more {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
}

/* AI 摘要 */
.ai-summary {
  margin-bottom: 12px;
  padding-left: 2px;
}

.ai-summary p {
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
  transition: all 0.3s;
}

.ai-summary p.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.toggle-btn {
  background: none;
  border: none;
  color: #000;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
}

.generate-btn {
  background: var(--n-200);
  border: 1px dashed var(--n-300);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.86rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 10px;
  width: 100%;
}

.generate-btn:hover {
  background: var(--n-300);
  border-color: #000;
}

.generate-btn.loading {
  opacity: 0.65;
  cursor: wait;
}

/* AI 错误提示 */
.ai-error {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: oklch(97% 0.01 15);
  border-left: 3px solid oklch(55% 0.18 25);
}

.ai-error p {
  font-size: 0.84rem;
  color: var(--text-secondary);
  margin: 0 0 6px 0;
}

.retry-btn {
  background: none;
  border: none;
  color: #000;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
}

/* 标签 */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.tag-pill {
  padding: 3px 11px;
  border-radius: 12px;
  font-size: 0.78rem;
  color: white;
}

/* 操作按钮 */
.actions {
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  padding: 7px 18px;
  border-radius: 20px;
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #000;
  color: white;
}

.action-btn.primary:hover {
  opacity: 0.85;
  transform: translateX(2px);
}
</style>
