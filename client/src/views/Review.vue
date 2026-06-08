<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { photos } from '../api'

const router = useRouter()
const years = ref([])
const selectedYear = ref(null)
const reviewData = ref(null)
const loading = ref(true)
const reviewError = ref(null)

// AI 回顾相关状态
const aiLoading = ref(false)
const aiError = ref(null)
const aiErrorMessage = computed(() => {
  if (!reviewData.value?.aiError) return null
  const err = reviewData.value.aiError
  // 根据错误类型返回更友好的提示
  const errorMessages = {
    'AI_NOT_ENABLED': 'AI 功能未启用，请在设置中开启',
    'NO_API_KEY': '未配置 API Key，请在 AI 设置中填写',
    'INVALID_API_KEY': 'API Key 无效或已过期，请检查设置中的 API Key',
    'INVALID_MODEL': err.message || '模型不存在，请检查模型名称是否正确（推荐：glm-4-flash）',
    'TIMEOUT': '请求超时，AI 服务响应时间过长，请稍后重试',
    'NETWORK_ERROR': '网络连接失败，请检查网络或 AI 服务是否正常运行',
    'RATE_LIMIT': '请求过于频繁，请稍后重试',
    'EMPTY_RESPONSE': 'AI 返回内容为空，请稍后重试'
  }
  return errorMessages[err.error] || err.message || '未知错误'
})

// 加载可选年份
const loadYears = async () => {
  try {
    const res = await photos.getReviewYears()
    years.value = res.years
    if (years.value.length > 0) {
      selectedYear.value = years.value[0]
    }
  } catch (e) {
    console.error(e)
  }
}

// 加载年度回顾数据
const loadReview = async () => {
  if (!selectedYear.value) return
  loading.value = true
  reviewError.value = null
  aiError.value = null
  try {
    const res = await photos.getReview(selectedYear.value)
    reviewData.value = res
    // 如果有 AI 错误信息，显示出来
    if (res.aiError) {
      aiError.value = res.aiError
      console.warn('[Review] AI Error:', res.aiError)
    }
  } catch (e) {
    console.error(e)
    reviewData.value = null
    reviewError.value = e.response?.data?.error || e.message || '年度回顾加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 重新生成 AI 回顾
const regenerateAiSummary = async () => {
  if (!selectedYear.value || aiLoading.value) return

  aiLoading.value = true
  aiError.value = null

  try {
    // 重新加载整个年度回顾数据（包含重新生成 AI 总结）
    const res = await photos.getReview(selectedYear.value, { regenerate: true })
    reviewData.value = res

    if (res.aiSummary && !res.aiError) {
      // 成功生成
      console.log('[Review] AI 回顾重新生成成功')
    } else if (res.aiError) {
      aiError.value = res.aiError
      console.error('[Review] AI 重新生成失败:', res.aiError)
    }
  } catch (e) {
    console.error('[Review] 重新生成失败:', e)
    aiError.value = {
      error: 'REGENERATE_FAILED',
      message: '重新生成失败：' + (e.response?.data?.error || e.message || '未知错误')
    }
  } finally {
    aiLoading.value = false
  }
}

// 切换年份
const changeYear = (year) => {
  selectedYear.value = year
  loadReview()
}

// 格式化文件大小
const formatSize = (kb) => {
  if (!kb) return '0 KB'
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// 月份名称
const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

onMounted(() => {
  loadYears().then(() => {
    if (selectedYear.value) {
      loadReview()
    } else {
      loading.value = false
    }
  })
})
</script>

<template>
  <div class="review">
    <div class="container">
      <div class="header-section">
        <h1>年度回顾</h1>
        <p class="subtitle">用光影记录 {{ selectedYear }} 年的美好瞬间</p>
      </div>

      <!-- 年份选择 -->
      <div v-if="years.length > 0" class="year-selector">
        <button 
          v-for="year in years" 
          :key="year"
          :class="{ active: selectedYear === year }"
          @click="changeYear(year)"
        >
          {{ year }}
        </button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="reviewError" class="error-message">
        <p>获取年度回顾失败</p>
        <p class="hint">{{ reviewError }}</p>
      </div>
      <div v-else-if="!reviewData || reviewData.totalPhotos === 0" class="empty">
        <p>{{ selectedYear }} 年还没有照片</p>
        <p class="hint">去上传一些照片吧！</p>
      </div>

      <template v-else>
        <!-- AI 自动生成年度总结 -->
        <div class="review-summary">
          <div class="summary-header">
            <h2>🤖 年度 AI 回顾</h2>
            <button
              class="regenerate-btn"
              @click="regenerateAiSummary"
              :disabled="aiLoading"
              :title="'重新生成 AI 回顾'"
            >
              {{ aiLoading ? '⏳ 生成中...' : '🔄 重新生成' }}
            </button>
          </div>

          <!-- 加载状态 -->
          <div v-if="aiLoading" class="ai-loading">
            <div class="loading-spinner"></div>
            <p>AI 正在分析你的年度照片数据...</p>
          </div>

          <!-- 成功状态 -->
          <div v-else-if="reviewData.aiSummary" class="ai-content">
            <p>{{ reviewData.aiSummary }}</p>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="aiErrorMessage" class="ai-error">
            <p class="error-title">❌ AI 回顾生成失败</p>
            <p class="error-message">{{ aiErrorMessage }}</p>
            <!-- 针对特定错误给出建议 -->
            <div class="error-suggestions">
              <p v-if="reviewData.aiError?.error === 'INVALID_API_KEY'" class="suggestion">
                💡 建议：请前往<a href="/settings">设置页面</a>检查 API Key 是否正确填写
              </p>
              <p v-else-if="reviewData.aiError?.error === 'INVALID_MODEL'" class="suggestion">
                💡 建议：请前往<a href="/settings">设置页面</a>将模型改为 glm-4-flash（免费且稳定）
              </p>
              <p v-else-if="reviewData.aiError?.error === 'NO_API_KEY'" class="suggestion">
                💡 建议：请前往<a href="/settings">设置页面</a>配置 API Key
              </p>
              <p v-else-if="reviewData.aiError?.error === 'TIMEOUT'" class="suggestion">
                💡 建议：可能是网络较慢，点击上方"重新生成"按钮重试
              </p>
              <p v-else class="suggestion">
                💡 请检查网络连接或<a href="/settings">AI 设置</a>，然后重试
              </p>
            </div>
          </div>

          <!-- 默认占位 -->
          <p v-else class="summary-placeholder">AI 回顾尚未生成或数据不足，请确保该年份已有照片并刷新页面。</p>
        </div>

        <!-- 总览卡片 -->
        <div class="overview-cards">
          <div class="overview-card highlight">
            <div class="card-value">{{ reviewData.totalPhotos }}</div>
            <div class="card-label">张照片</div>
          </div>
          <div class="overview-card">
            <div class="card-value">{{ formatSize(reviewData.totalSize) }}</div>
            <div class="card-label">存储空间</div>
          </div>
          <div class="overview-card">
            <div class="card-value">{{ reviewData.photosWithGps }}</div>
            <div class="card-label">带定位</div>
          </div>
        </div>

        <!-- 时间范围 -->
        <div class="date-range" v-if="reviewData.firstPhoto && reviewData.lastPhoto">
          <p>📅 {{ reviewData.firstPhoto }} ~ {{ reviewData.lastPhoto }}</p>
        </div>

        <!-- 月度分布 -->
        <div class="section">
          <h2>月度分布</h2>
          <div class="monthly-chart">
            <div 
              v-for="m in 12" 
              :key="m"
              class="month-bar"
              :style="{ height: (reviewData.monthlyStats.find(x => x.month === m)?.count || 0) / Math.max(...reviewData.monthlyStats.map(x => x.count), 1) * 100 + '%' }"
            >
              <span class="month-label">{{ monthNames[m-1].replace('月', '') }}</span>
              <span class="month-count">{{ reviewData.monthlyStats.find(x => x.month === m)?.count || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 热门标签 -->
        <div class="section" v-if="reviewData.topTags.length > 0">
          <h2>热门标签</h2>
          <div class="tags-cloud">
            <span 
              v-for="tag in reviewData.topTags" 
              :key="tag.id"
              class="tag-item"
              :style="{ backgroundColor: 'oklch(41.462% 0.04699 149.954)' }"
            >
              {{ tag.name }} ({{ tag.count }})
            </span>
          </div>
        </div>

        <!-- 热门地点 -->
        <div class="section" v-if="reviewData.topLocations.length > 0">
          <h2>热门地点</h2>
          <div class="locations-list">
            <div 
              v-for="(loc, idx) in reviewData.topLocations" 
              :key="loc.location"
              class="location-item"
            >
              <span class="rank">{{ idx + 1 }}</span>
              <span class="name">{{ loc.location }}</span>
              <span class="count">{{ loc.count }} 张</span>
            </div>
          </div>
        </div>

        <!-- 照片尺寸统计 -->
        <div class="section">
          <h2>照片尺寸</h2>
          <div class="size-stats">
            <div class="stat-item">
              <span class="stat-value">{{ reviewData.avgWidth }} × {{ reviewData.avgHeight }}</span>
              <span class="stat-label">平均尺寸</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.review {
  min-height: calc(100vh - 140px);
  padding-bottom: 40px;
}

.header-section {
  text-align: center;
  padding: 40px 0 24px;
}

.header-section h1 {
  font-size: 2rem;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
}

.year-selector {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}

.year-selector button {
  background: var(--input-bg);
  border: none;
  padding: 10px 20px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.year-selector button.active {
  background: oklch(41.462% 0.04699 149.954);
  color: var(--card-bg);
  transform: scale(1.05);
}

.loading, .empty, .error-message {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.error-message {
  background: rgba(255, 235, 238, 0.9);
  border: 1px solid #f5c2c7;
  color: #b71c1c;
  border-radius: 12px;
  margin-bottom: 16px;
}

.hint {
  margin-top: 8px;
  font-size: 0.9rem;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.overview-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  min-height: 120px;
  box-shadow: 0 2px 8px var(--shadow-color);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

  .review-summary {
    background: linear-gradient(135deg, #f6f9ff, #e8f1ff);
    border: 1px solid #d0e4ff;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    color: #1f3d7a;
    line-height: 1.8;
    position: relative;
  }

  .review-summary h2 {
    margin-bottom: 12px;
    font-size: 1.1rem;
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .summary-header h2 {
    margin-bottom: 0 !important;
  }

  .regenerate-btn {
    background: oklch(41.462% 0.04699 149.954);
    color: white;
    border: none;
    padding: 6px 14px;
    border-radius: 18px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .regenerate-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(65, 153, 63, 0.3);
  }

  .regenerate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ai-loading {
    text-align: center;
    padding: 20px;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #e0e7ff;
    border-top-color: oklch(41.462% 0.04699 149.954);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .ai-content p {
    font-size: 1rem;
    line-height: 1.9;
  }

  .ai-error {
    background: rgba(255, 235, 238, 0.5);
    border-left: 4px solid #ef5350;
    padding: 16px;
    border-radius: 8px;
    margin-top: 8px;
  }

  .error-title {
    font-weight: 600;
    color: #c62828;
    margin-bottom: 8px;
  }

  .error-message {
    color: #d32f2f;
    margin-bottom: 10px;
    font-size: 0.95rem;
  }

  .error-suggestions {
    background: rgba(255, 243, 224, 0.6);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 0.88rem;
  }

  .suggestion {
    color: #e65100;
    margin: 4px 0;
    line-height: 1.6;
  }

  .suggestion a {
    color: #1565c0;
    text-decoration: underline;
    font-weight: 500;
  }

  .summary-placeholder {
    color: var(--text-secondary);
    font-style: italic;
  }

.overview-card.highlight {
  background: linear-gradient(135deg, oklch(41.462% 0.04699 149.954), oklch(41.462% 0.04699 149.954));
  color: var(--card-bg);
}

.card-value {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 4px;
}

.card-label {
  font-size: 0.9rem;
  opacity: 0.8;
}

.date-range {
  text-align: center;
  margin-bottom: 32px;
  color: var(--text-secondary);
}

.section {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.section h2 {
  font-size: 1.2rem;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--input-bg);
}

.monthly-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 120px;
  gap: 4px;
}

.month-bar {
  flex: 1;
  background: linear-gradient(to top, oklch(41.462% 0.04699 149.954), oklch(41.462% 0.04699 149.954));
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.month-label {
  font-size: 10px;
  color: var(--text-tertiary);
  position: absolute;
  bottom: -20px;
}

.month-count {
  font-size: 10px;
  color: var(--card-bg);
  padding: 2px 0;
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-item {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 0.9rem;
  color: var(--card-bg);
}

.locations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--input-bg);
  border-radius: 8px;
}

.rank {
  width: 24px;
  height: 24px;
  background: oklch(41.462% 0.04699 149.954);
  color: var(--card-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
}

.name {
  flex: 1;
  font-weight: 500;
}

.count {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.size-stats {
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
}

.stat-label {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .overview-card.highlight {
    order: -1;
  }
  
  .monthly-chart {
    height: 100px;
  }
}
</style>
