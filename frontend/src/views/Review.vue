<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { photos } from '../api'
import { useAuthStore } from '../stores'

const authStore = useAuthStore()

const years = ref([])
const selectedYear = ref(null)
const reviewData = ref(null)
const loading = ref(true)
const reviewError = ref(null)

// AI 回顾相关状态
const aiLoading = ref(false)
const aiError = ref(null)

// 动画数字状态
const animatedTotal = ref(0)
const showContent = ref(false)

const aiErrorMessage = computed(() => {
  if (!reviewData.value?.aiError) return null
  const err = reviewData.value.aiError
  const errorMessages = {
    'AI_NOT_ENABLED': 'AI 功能未启用，请在设置中开启',
    'NO_API_KEY': '未配置 API Key，请在 AI 设置中填写',
    'INVALID_API_KEY': 'API Key 无效或已过期',
    'INVALID_MODEL': err.message || '模型不存在（推荐：glm-4-flash）',
    'TIMEOUT': '请求超时，请稍后重试',
    'NETWORK_ERROR': '网络连接失败',
    'RATE_LIMIT': '请求过于频繁',
    'EMPTY_RESPONSE': 'AI 返回内容为空'
  }
  return errorMessages[err.error] || err.message || '未知错误'
})

// 数字动画
const animateNumber = (target, duration = 1200) => {
  const start = performance.now()
  const from = 0
  const to = target

  const step = (now) => {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    animatedTotal.value = Math.round(from + (to - from) * eased)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const loadYears = async () => {
  try {
    const res = await photos.getReviewYears()
    years.value = res.years
    if (years.value.length > 0) selectedYear.value = years.value[0]
  } catch (e) { console.error(e) }
}

const loadReview = async () => {
  if (!selectedYear.value) return
  loading.value = true
  reviewError.value = null
  showContent.value = false
  try {
    const res = await photos.getReview(selectedYear.value)
    reviewData.value = res
    if (res.aiError) aiError.value = res.aiError

    // 触发动画
    await nextTick()
    setTimeout(() => { showContent.value = true }, 80)
    if (res.totalPhotos > 0) animateNumber(res.totalPhotos, 1500)
  } catch (e) {
    reviewData.value = null
    reviewError.value = e.response?.data?.error || e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const regenerateAiSummary = async () => {
  if (!selectedYear.value || aiLoading.value) return
  aiLoading.value = true
  try {
    const res = await photos.getReview(selectedYear.value, { regenerate: true })
    reviewData.value = res
    if (res.aiError) aiError.value = res.aiError
  } catch (e) {
    aiError.value = { error: 'REGENERATE_FAILED', message: '重新生成失败' }
  } finally {
    aiLoading.value = false
  }
}

const changeYear = (year) => {
  selectedYear.value = year
  loadReview()
}

const formatSize = (kb) => {
  if (!kb) return '0 KB'
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const heroPhotoStyle = computed(() => {
  if (!reviewData.value?.heroPhoto?.url) return {}
  return { backgroundImage: `url(${reviewData.value.heroPhoto.url})` }
})

const statPhotoStyle = (index) => {
  const photo = reviewData.value?.statPhotos?.[index]
  if (!photo?.url) return {}
  return { backgroundImage: `url(${photo.url})` }
}

// 柱状图辅助
const maxMonthCount = computed(() => {
  if (!reviewData.value?.monthlyStats) return 1
  return Math.max(...reviewData.value.monthlyStats.map(m => m.count), 1)
})

const getCount = (month) => reviewData.value?.monthlyStats?.find(m => m.month === month)?.count || 0
const getHeatHeight = (m) => {
  const count = getCount(m)
  const ratio = maxMonthCount.value > 0 ? count / maxMonthCount.value : 0
  return `${Math.max(ratio * 100, 8)}%`
}
const getHeatOpacity = (m) => { const c = getCount(m); return maxMonthCount.value > 0 ? 0.25 + (c / maxMonthCount.value) * 0.55 : 0.2 }
const getHeatLightness = (m) => { const c = getCount(m); return Math.round(85 - (c / maxMonthCount.value) * 55) }
const getHeatHue = (m) => { const c = getCount(m); return maxMonthCount.value > 0 ? Math.round(260 - (c / maxMonthCount.value) * 20) : 260 }

// 折线图
const linePoints = computed(() => {
  if (!reviewData.value?.monthlyStats?.length) return ''
  const max = maxMonthCount.value
  const points = []
  for (let m = 1; m <= 12; m++) {
    const count = getCount(m)
    const x = ((m - 1) / 11) * 100
    const y = max > 0 ? (1 - count / max) * 36 + 2 : 38
    points.push(`${x},${y}`)
  }
  return points.join(' ')
})

onMounted(() => {
  loadYears().then(() => {
    if (selectedYear.value) loadReview()
    else loading.value = false
  })
})

watch(() => authStore.token, async () => {
  selectedYear.value = null
  reviewData.value = null
  await loadYears()
  if (selectedYear.value) loadReview()
})
</script>

<template>
  <div class="review-page">
    <!-- 年份选择 -->
    <div class="year-bar">
      <div class="year-pills" v-if="years.length > 0">
        <button v-for="y in years" :key="y" :class="{ active: selectedYear === y }" @click="changeYear(y)">
          {{ y }} 年度报告
        </button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && !reviewData" class="full-loader">
      <div class="loader-ring"></div>
      <p>正在生成你的光影年报...</p>
    </div>

    <!-- 错误 -->
    <div v-else-if="reviewError && !reviewData" class="error-block">
      <p>获取年度回顾失败</p>
      <span>{{ reviewError }}</span>
      <button @click="loadReview">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!reviewData || reviewData.totalPhotos === 0" class="empty-block">
      <div class="empty-visual">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <p class="empty-title">{{ selectedYear }} 年还没有记录</p>
      <p class="empty-desc">这一年似乎很安静，用镜头留住下一个瞬间吧</p>
      <router-link to="/admin" class="empty-action">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        上传照片
      </router-link>
    </div>

    <!-- 报告内容 -->
    <template v-else>
      <!-- Block 1: Hero with photo background -->
      <section class="hero-block" :class="{ visible: showContent }">
        <div class="hero-bg"></div>
        <div class="hero-photo" :style="heroPhotoStyle" v-if="reviewData?.heroPhoto?.url"></div>
        <div class="hero-inner">
          <p class="hero-year">{{ selectedYear }}</p>
          <h1 class="hero-title">
            <span class="counter">{{ animatedTotal }}</span>
            <span class="hero-unit">张照片</span>
          </h1>
          <p class="hero-dates" v-if="reviewData.firstPhoto && reviewData.lastPhoto">
            {{ reviewData.firstPhoto.slice(0, 10) }} — {{ reviewData.lastPhoto.slice(0, 10) }}
          </p>
        </div>
      </section>

      <!-- Block 2: AI 年度总叙 -->
      <section class="ai-section" :class="{ visible: showContent }">
        <div class="ai-card">
          <div class="ai-header">
            <h2>AI 年度回顾</h2>
            <button class="regen-btn" @click="regenerateAiSummary" :disabled="aiLoading">
              {{ aiLoading ? '生成中...' : '重新生成' }}
            </button>
          </div>
          <div v-if="aiLoading" class="ai-loading">
            <div class="mini-spinner"></div>
            <p>正在分析年度数据...</p>
          </div>
          <p v-else-if="reviewData.aiSummary" class="ai-body">{{ reviewData.aiSummary }}</p>
          <div v-else-if="aiErrorMessage" class="ai-err">
            <p class="err-title">生成失败</p>
            <p>{{ aiErrorMessage }}</p>
          </div>
          <p v-else class="ai-placeholder">暂无回顾内容</p>
        </div>
      </section>

      <!-- Block 3: 数据概览 — 照片背景卡片 -->
      <section class="stats-grid" :class="{ visible: showContent }">
        <div class="stat-card main">
          <div class="stat-bg"></div>
          <div class="stat-photo" :style="statPhotoStyle(0)" v-if="reviewData?.statPhotos?.[0]?.url"></div>
          <div class="stat-frost"></div>
          <div class="stat-content">
            <span class="stat-value">{{ reviewData.totalPhotos }}</span>
            <span class="stat-label">全年照片</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-bg"></div>
          <div class="stat-photo" :style="statPhotoStyle(1)" v-if="reviewData?.statPhotos?.[1]?.url"></div>
          <div class="stat-frost"></div>
          <div class="stat-content">
            <span class="stat-value">{{ formatSize(reviewData.totalSize) }}</span>
            <span class="stat-label">存储空间</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-bg"></div>
          <div class="stat-photo" :style="statPhotoStyle(2)" v-if="reviewData?.statPhotos?.[2]?.url"></div>
          <div class="stat-frost"></div>
          <div class="stat-content">
            <span class="stat-value">{{ reviewData.photosWithGps || 0 }}</span>
            <span class="stat-label">带定位</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-bg"></div>
          <div class="stat-photo" :style="statPhotoStyle(3)" v-if="reviewData?.statPhotos?.[3]?.url"></div>
          <div class="stat-frost"></div>
          <div class="stat-content">
            <span class="stat-value">{{ reviewData.avgWidth || 0 }}×{{ reviewData.avgHeight || 0 }}</span>
            <span class="stat-label">平均尺寸</span>
          </div>
        </div>
      </section>

      <!-- Block 4: 月度折线图 -->
      <section class="block-section" v-if="reviewData.monthlyStats?.length" :class="{ visible: showContent }">
        <h2 class="sec-title">月度趋势</h2>
        <div class="line-chart-wrap">
          <svg viewBox="0 0 100 38" preserveAspectRatio="none" class="line-chart">
            <polyline :points="linePoints" fill="none" stroke="oklch(60% 0.06 250)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          <div class="line-labels">
            <span v-for="m in 12" :key="m" class="line-label">{{ monthNames[m - 1].replace('月', '') }}</span>
          </div>
        </div>
      </section>

      <!-- Block 5: 月度柱状图 -->
      <section class="block-section" v-if="reviewData.monthlyStats?.length" :class="{ visible: showContent }">
        <h2 class="sec-title">月度拍摄分布</h2>
        <div class="heatmap-grid">
          <div
            v-for="m in 12"
            :key="m"
            class="heat-cell"
            :style="{
              height: getHeatHeight(m),
              opacity: getHeatOpacity(m),
              background: `oklch(${getHeatLightness(m)}% 0.04 ${getHeatHue(m)})`
            }"
          >
            <span class="cell-month">{{ monthNames[m - 1].replace('月', '') }}</span>
            <span class="cell-count">{{ getCount(m) }}</span>
          </div>
        </div>
      </section>

      <!-- Block 6: 热门标签 -->
      <section class="block-section" v-if="reviewData.topTags?.length" :class="{ visible: showContent }">
        <h2 class="sec-title">热门标签</h2>
        <div class="tag-cloud">
          <span v-for="tag in reviewData.topTags" :key="tag.id" class="tag-item">
            {{ tag.name }}
            <small>{{ tag.count }}</small>
          </span>
        </div>
      </section>

      <!-- Block 7: 地点足迹 -->
      <section class="block-section" v-if="reviewData.topLocations?.length" :class="{ visible: showContent }">
        <h2 class="sec-title">地点足迹</h2>
        <div class="location-list">
          <div v-for="(loc, idx) in reviewData.topLocations" :key="loc.location" class="loc-item">
            <span class="loc-rank">{{ idx + 1 }}</span>
            <span class="loc-name">{{ loc.location }}</span>
            <span class="loc-count">{{ loc.count }} 张</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ====== 冷调黑白配色系统 ====== */
.review-page {
  --bg-card: #fff;
  --bg-section: oklch(97% 0.002 260);
  --border-light: oklch(90% 0.003 260);
  --border-divider: oklch(92% 0.003 260);
  --text-p: oklch(12% 0.003 260);
  --text-s: oklch(42% 0.005 260);
  --text-t: oklch(58% 0.005 260);

  max-width: 720px;
  margin: 0 auto;
  padding-bottom: 60px;
}

/* 年份选择栏 */
.year-bar {
  display: flex;
  justify-content: center;
  padding: 20px 0 24px;
}
.year-pills { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.year-pills button {
  background: transparent;
  border: 1px solid var(--border-light);
  padding: 8px 22px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-s);
  transition: all 0.25s ease;
}

.year-pills button.active {
  background: #000;
  border-color: #000;
  color: #fff;
}
.year-pills button:hover:not(.active) { border-color: #000; color: var(--text-p); }

/* 全屏状态 */
.full-loader, .error-block, .empty-block {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-t);
}
.full-loader p, .empty-block p { margin-top: 14px; font-size: 0.95rem; }
.error-block span { display: block; font-size: 0.86rem; margin-top: 6px; opacity: 0.7; }
.full-loader .loader-ring {
  width: 44px; height: 44px; border: 3px solid var(--border-light);
  border-top-color: #000; border-radius: 50%;
  animation: spin 0.75s linear infinite; margin: 0 auto 18px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error-block button {
  background: #000; color: #fff; padding: 8px 24px;
  border-radius: 20px; border: none; cursor: pointer;
}

/* Empty state */
.empty-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: var(--bg-color, #f5f5f5);
  color: var(--text-t);
  margin-bottom: 0.5rem;
}

.empty-title {
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-p);
  margin: 0 0 0.375rem;
}

.empty-desc {
  font-size: 0.875rem;
  color: var(--text-t);
  margin: 0 0 1.5rem;
}

.empty-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: #000;
  color: #fff;
  text-decoration: none;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.empty-action:hover {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* ====== Block 1: Hero 照片背景 ====== */
.hero-block {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  min-height: 340px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.hero-block.visible { opacity: 1; transform: translateY(0); }

.hero-bg {
  position: absolute; inset: 0;
  background: oklch(28% 0.04 250);
}

.hero-photo {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.12;
  mix-blend-mode: screen;
}

.hero-inner {
  position: relative; z-index: 2;
  margin: 0;
  padding: 20px 36px;
  border-radius: 16px;
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  color: #fff;
  text-align: center;
  width: auto;
}

.hero-year {
  font-size: 0.82rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 8px;
  text-shadow: 0 2px 12px rgba(0,0,0,0.4);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

.hero-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

.counter {
  font-size: 4rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  text-shadow: 0 2px 20px rgba(0,0,0,0.3);
}

.hero-unit {
  font-size: 1.2rem;
  font-weight: 400;
  opacity: 0.7;
}

.hero-dates {
  margin-top: 10px;
  font-size: 0.84rem;
  opacity: 0.5;
  text-shadow: 0 2px 12px rgba(0,0,0,0.4);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

/* ====== Block 2: AI 总叙 ====== */
.ai-section { margin: 32px 0; opacity: 0; transform: translateY(20px); transition: all 0.6s ease 0.15s; }
.ai-section.visible { opacity: 1; transform: translateY(0); }

.ai-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px; padding: 28px;
}

.ai-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.ai-header h2 { font-size: 0.88rem; font-weight: 600; margin: 0; color: var(--text-s); text-transform: uppercase; letter-spacing: 0.08em; }

.regen-btn {
  background: none; color: var(--text-s); border: 1px solid var(--border-light);
  padding: 5px 14px; border-radius: 14px; cursor: pointer;
  font-size: 0.78rem; transition: all 0.2s;
}
.regen-btn:hover:not(:disabled) { border-color: #000; color: #000; }
.regen-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-loading { text-align: center; padding: 16px; color: var(--text-s); }
.mini-spinner { width: 22px; height: 22px; border: 2px solid var(--border-light); border-top-color: #000; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 10px; }
.ai-loading p { font-size: 0.86rem; }

.ai-body { font-size: 0.96rem; line-height: 1.85; color: var(--text-p); white-space: pre-wrap; word-break: break-word; }
.ai-err { border-left: 3px solid #000; padding: 12px 16px; background: var(--bg-section); border-radius: 6px; }
.err-title { font-weight: 600; color: #000; margin-bottom: 4px; }
.ai-err p:last-child { font-size: 0.86rem; color: var(--text-s); margin: 0; }
.ai-placeholder { color: var(--text-t); font-style: italic; }

/* ====== Block 3: 照片背景统计卡片 ====== */
.stats-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 10px;
  margin: 32px 0;
  opacity: 0; transform: translateY(20px);
  transition: all 0.6s ease 0.25s;
}
.stats-grid.visible { opacity: 1; transform: translateY(0); }

.stat-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-bg {
  position: absolute; inset: 0;
}
.stat-card.main .stat-bg { background: oklch(30% 0.04 250); }
.stat-card:nth-child(2) .stat-bg { background: oklch(26% 0.04 255); }
.stat-card:nth-child(3) .stat-bg { background: oklch(32% 0.04 245); }
.stat-card:nth-child(4) .stat-bg { background: oklch(28% 0.04 260); }

.stat-photo {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.12;
  mix-blend-mode: screen;
}

.stat-frost {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}

.stat-card.main {
  grid-row: span 2;
  min-height: 250px;
}

.stat-content {
  position: relative; z-index: 3;
  text-align: center;
  color: #fff;
  padding: 16px;
}

.stat-value {
  display: block;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.stat-card.main .stat-value { font-size: 3rem; }

.stat-label {
  display: block;
  font-size: 0.78rem;
  opacity: 0.7;
  margin-top: 4px;
  font-weight: 400;
  letter-spacing: 0.04em;
}

@media (max-width: 600px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .stat-card.main { grid-row: auto; grid-column: span 2; min-height: 180px; }
  .stat-card.main .stat-value { font-size: 2.2rem; }
}

/* ====== Block 4-7: 通用区块 ====== */
.block-section { margin: 32px 0; opacity: 0; transform: translateY(20px); transition: all 0.6s ease; }
.block-section:nth-of-type(2) { transition-delay: 0.15s; }
.block-section:nth-of-type(3) { transition-delay: 0.25s; }
.block-section:nth-of-type(4) { transition-delay: 0.35s; }
.block-section.visible { opacity: 1; transform: translateY(0); }

.sec-title { font-size: 0.88rem; font-weight: 600; margin-bottom: 16px; color: var(--text-s); text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 8px; border-bottom: 1px solid var(--border-divider); }

/* 月度热力图 */
.heatmap-grid {
  display: flex; align-items: flex-end; gap: 5px; height: 120px;
  padding: 0 2px;
}
.heat-cell {
  flex: 1; border-radius: 3px 3px 1px 1px; min-height: 4px;
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 3px; transition: transform 0.2s; position: relative;
}
.heat-cell:hover { transform: scaleY(1.04); }
.cell-month { font-size: 8px; color: #fff; opacity: 0.75; }
.cell-count { font-size: 8px; color: #fff; opacity: 0.85; font-weight: 600; }

/* 月度折线图 */
.line-chart-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 20px 16px 0;
}
.line-chart {
  width: 100%;
  height: 140px;
  display: block;
}
.line-labels {
  display: flex;
  justify-content: space-between;
  padding: 6px 0 0;
  margin-top: 4px;
  border-top: 1px solid var(--border-divider);
}
.line-label {
  font-size: 8px;
  color: var(--text-t);
  width: 8.33%;
  text-align: center;
}

/* 黑白标签云 */
.tag-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-item {
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 5px 14px;
  font-size: 0.84rem;
  color: var(--text-p);
  display: inline-flex;
  gap: 5px;
  transition: all 0.2s;
}
.tag-item:hover { border-color: #000; }
.tag-item small { color: var(--text-t); font-size: 0.8em; }

/* 地点列表（纯文字） */
.location-list { display: flex; flex-direction: column; gap: 6px; }
.loc-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-divider);
}
.loc-item:last-child { border-bottom: none; }
.loc-rank {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--bg-section); border: 1px solid var(--border-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.74rem; font-weight: 600; color: var(--text-s); flex-shrink: 0;
}
.loc-name { font-weight: 500; color: var(--text-p); flex-shrink: 0; }
.loc-count { color: var(--text-t); font-size: 0.82rem; margin-left: auto; }

</style>

<style>
.dark .review-page {
  --bg-card: oklch(18% 0.008 260);
  --bg-section: oklch(14% 0.008 260);
  --border-light: oklch(30% 0.01 260);
  --border-divider: oklch(25% 0.01 260);
  --text-p: oklch(90% 0.003 260);
  --text-s: oklch(70% 0.005 260);
  --text-t: oklch(65% 0.005 260);
}
.dark .year-pills button.active {
  background: #fff;
  border-color: #fff;
  color: #000;
}
.dark .year-pills button:hover:not(.active) {
  border-color: #fff;
  color: var(--text-p);
}
.dark .full-loader .loader-ring {
  border-top-color: #fff;
}
.dark .error-block button {
  background: #fff;
  color: #000;
}
.dark .empty-action {
  background: #fff;
  color: #000;
}
.dark .regen-btn:hover:not(:disabled) {
  border-color: #fff;
  color: #fff;
}
.dark .mini-spinner {
  border-top-color: #fff;
}
.dark .ai-err {
  border-left-color: #fff;
}
.dark .err-title {
  color: #fff;
}
.dark .tag-item:hover {
  border-color: #fff;
}
</style>
