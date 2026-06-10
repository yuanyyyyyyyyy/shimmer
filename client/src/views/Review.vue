<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { photos } from '../api'

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

// 热力图辅助
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
const getHeatOpacity = (m) => { const c = getCount(m); return maxMonthCount.value > 0 ? 0.4 + (c / maxMonthCount.value) * 0.6 : 0.3 }
const getHeatLightness = (m) => { const c = getCount(m); return Math.round(72 - (c / maxMonthCount.value) * 30) }
const getHeatChroma = (m) => { const c = getCount(m); return (0.06 + (c / maxMonthCount.value) * 0.12).toFixed(2) }

onMounted(() => {
  loadYears().then(() => {
    if (selectedYear.value) loadReview()
    else loading.value = false
  })
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
      <p>📷 {{ selectedYear }} 年还没有照片</p>
      <router-link to="/">去上传一些照片吧</router-link>
    </div>

    <!-- 报告内容 -->
    <template v-else>
      <!-- Block 1: Hero 开场 -->
      <section class="hero-block" :class="{ visible: showContent }">
        <div class="hero-bg"></div>
        <div class="hero-inner">
          <p class="hero-label">{{ selectedYear }} 年度 · 光影手记</p>
          <h1 class="hero-title">
            你记录了<br/>
            <span class="counter">{{ animatedTotal }}</span> 张<span class="highlight">光影瞬间</span>
          </h1>
          <p class="hero-range" v-if="reviewData.firstPhoto && reviewData.lastPhoto">
            {{ reviewData.firstPhoto.slice(0, 10) }} ~ {{ reviewData.lastPhoto.slice(0, 10) }}
          </p>
        </div>
      </section>

      <!-- Block 2: AI 年度总叙 -->
      <section class="ai-section" :class="{ visible: showContent }">
        <div class="ai-card">
          <div class="ai-header">
            <h2><span class="ai-icon">✨</span> AI 年度回顾</h2>
            <button class="regen-btn" @click="regenerateAiSummary" :disabled="aiLoading">
              {{ aiLoading ? '生成中...' : '重新生成' }}
            </button>
          </div>
          <div v-if="aiLoading" class="ai-loading">
            <div class="mini-spinner"></div>
            <p>AI 正在分析你的年度数据...</p>
          </div>
          <p v-else-if="reviewData.aiSummary" class="ai-body">{{ reviewData.aiSummary }}</p>
          <div v-else-if="aiErrorMessage" class="ai-err">
            <p class="err-title">❌ 生成失败</p>
            <p>{{ aiErrorMessage }}</p>
          </div>
          <p v-else class="ai-placeholder">暂无 AI 回顾内容</p>
        </div>
      </section>

      <!-- Block 3: 数据概览网格 -->
      <section class="stats-grid" :class="{ visible: showContent }">
        <div class="glass-card main">
          <div class="card-value">{{ reviewData.totalPhotos }}</div>
          <div class="card-label">张照片</div>
        </div>
        <div class="glass-card">
          <div class="card-value">{{ formatSize(reviewData.totalSize) }}</div>
          <div class="card-label">存储空间</div>
        </div>
        <div class="glass-card">
          <div class="card-value">{{ reviewData.photosWithGps || 0 }}</div>
          <div class="card-label">带定位</div>
        </div>
        <div class="glass-card">
          <div class="card-value">{{ reviewData.avgWidth || 0 }} × {{ reviewData.avgHeight || 0 }}</div>
          <div class="card-label">平均尺寸</div>
        </div>
      </section>

      <!-- Block 4: 月度热力图 -->
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
              background: `oklch(${getHeatLightness(m)}% ${getHeatChroma(m)} 75)`
            }"
          >
            <span class="cell-month">{{ monthNames[m - 1].replace('月', '') }}</span>
            <span class="cell-count">{{ getCount(m) }}</span>
          </div>
        </div>
      </section>

      <!-- Block 5: 热门标签 -->
      <section class="block-section" v-if="reviewData.topTags?.length" :class="{ visible: showContent }">
        <h2 class="sec-title">热门标签</h2>
        <div class="tag-cloud-enhanced">
          <span
            v-for="(tag, i) in reviewData.topTags"
            :key="tag.id"
            class="enhanced-tag"
            :style="{
              backgroundColor: tag.color || `oklch(${60 - i * 4}% ${0.08 + i * 0.01} 75)`,
              fontSize: `${0.85 + Math.min(i, 5) * 0.04}rem`,
              padding: `${5 + Math.max(0, 5 - i) * 2}px ${12 + Math.max(0, 5 - i) * 4}px`
            }"
          >
            {{ tag.name }}
            <small>{{ tag.count }}</small>
          </span>
        </div>
      </section>

      <!-- Block 6: 地点足迹 -->
      <section class="block-section" v-if="reviewData.topLocations?.length" :class="{ visible: showContent }">
        <h2 class="sec-title">地点足迹</h2>
        <div class="location-list">
          <div v-for="(loc, idx) in reviewData.topLocations" :key="loc.location" class="loc-item">
            <span class="loc-rank">{{ idx + 1 }}</span>
            <span class="loc-name">{{ loc.location }}</span>
            <span class="loc-count">{{ loc.count }} 张</span>
            <div class="loc-bar" :style="{ width: `${(loc.count / reviewData.topLocations[0].count) * 100}%` }"></div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ====== 变量系统 (OKLCH Impeccable Style) ====== */
.review-page {
  --c-primary: oklch(55% 0.16 75);
  --c-primary-light: oklch(85% 0.08 75);
  --c-primary-dark: oklch(38% 0.12 75);
  --n-100: oklch(98% 0.005 75); --n-200: oklch(94% 0.008 75);
  --n-300: oklch(86% 0.01 75);  --n-500: oklch(56% 0.014 75);
  --n-700: oklch(33% 0.013 75); --n-900: oklch(15% 0.008 75);
  --text-p: oklch(20% 0.015 75);   --text-s: oklch(40% 0.012 75);
  --text-t: oklch(54% 0.01 75);

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
  background: var(--n-200);
  border: 1px solid transparent;
  padding: 9px 22px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--text-s);
  transition: all 0.25s ease;
}

.year-pills button.active {
  background: var(--c-primary);
  color: white;
  box-shadow: 0 4px 16px oklch(55% 0.16 75 / 28%);
  transform: scale(1.03);
}
.year-pills button:hover:not(.active) { border-color: oklch(55% 0.08 75); color: var(--text-p); }

/* 全屏状态 */
.full-loader, .error-block, .empty-block {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-t);
}
.full-loader p, .empty-block p { margin-top: 14px; font-size: 0.95rem; }
.error-block span { display: block; font-size: 0.86rem; margin-top: 6px; opacity: 0.7; }
.full-loader .loader-ring {
  width: 44px; height: 44px; border: 3px solid var(--n-200);
  border-top-color: var(--c-primary); border-radius: 50%;
  animation: spin 0.75s linear infinite; margin: 0 auto 18px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty-block a, .error-block button {
  display: inline-block; margin-top: 14px; color: var(--c-primary);
  text-decoration: none; font-weight: 500;
}
.error-block button {
  background: var(--c-primary); color: white; padding: 8px 24px;
  border-radius: 20px; border: none; cursor: pointer;
}

/* ====== Block 1: Hero 开场 ====== */
.hero-block {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.hero-block.visible { opacity: 1; transform: translateY(0); }

.hero-bg {
  position: absolute; inset: 0;
  background: linear-gradient(145deg,
    oklch(22% 0.04 250), oklch(18% 0.06 75),
    oklch(16% 0.05 260), oklch(14% 0.03 75));
}
.hero-bg::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at 40% 40%, oklch(55% 0.16 75 / 8%), transparent 60%);
}

.hero-inner { position: relative; z-index: 1; padding: 32px 20px; color: white; }
.hero-label { font-size: 0.88rem; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.65; margin-bottom: 12px; }

.hero-title { font-size: 2.4rem; font-weight: 800; line-height: 1.25; letter-spacing: -0.02em; }
.counter { font-size: 3.5rem; display: inline-block; min-width: 140px; text-align: left; }
.highlight { color: oklch(70% 0.14 75); }

.hero-range { margin-top: 14px; font-size: 0.88rem; opacity: 0.55; }

/* ====== Block 2: AI 总叙 ====== */
.ai-section { margin: 28px 0; opacity: 0; transform: translateY(20px); transition: all 0.6s ease 0.15s; }
.ai-section.visible { opacity: 1; transform: translateY(0); }

.ai-card {
  background: linear-gradient(135deg, oklch(97% 0.012 75), oklch(95% 0.008 250));
  border: 1px solid oklch(88% 0.015 75);
  border-radius: 16px; padding: 24px;
}

.ai-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.ai-header h2 { font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-p); }
.ai-icon { margin-right: 6px; }

.regen-btn {
  background: var(--c-primary); color: white; border: none;
  padding: 6px 16px; border-radius: 18px; cursor: pointer;
  font-size: 0.82rem; transition: filter 0.2s;
}
.regen-btn:hover:not(:disabled) { filter: brightness(1.07); }
.regen-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.ai-loading { text-align: center; padding: 16px; color: var(--text-s); }
.mini-spinner { width: 24px; height: 24px; border: 2px solid var(--n-200); border-top-color: var(--c-primary); border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 10px; }
.ai-loading p { font-size: 0.88rem; }

.ai-body { font-size: 0.98rem; line-height: 1.9; color: oklch(30% 0.014 75); white-space: pre-wrap; word-break: break-word; }
.ai-err { background: oklch(97% 0.015 25); border-left: 3px solid oklch(55% 0.16 25); padding: 14px; border-radius: 8px; }
.err-title { font-weight: 600; color: oklch(45% 0.16 25); margin-bottom: 6px; }
.ai-err p:last-child { font-size: 0.88rem; color: oklch(45% 0.14 25); margin: 0; }
.ai-placeholder { color: var(--text-t); font-style: italic; }

/* ====== Block 3: 数据概览玻璃卡片 ====== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin: 28px 0;
  opacity: 0; transform: translateY(20px);
  transition: all 0.6s ease 0.25s;
  align-items: stretch;
}
.stats-grid.visible { opacity: 1; transform: translateY(0); }

.glass-card {
  background: linear-gradient(145deg, rgba(255,255,255,0.72), rgba(255,255,255,0.42));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 14px; padding: 16px 12px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  height: 140px; max-height: 140px; min-height: 0; overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.glass-card.main {
  background: linear-gradient(145deg, var(--c-primary), oklch(48% 0.14 75));
  border: none;
  color: white;
  box-shadow: 0 6px 24px oklch(55% 0.16 75 / 25%);
  height: 140px;
  max-height: 140px;
  overflow: hidden;
}

.card-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
.card-label { font-size: 0.78rem; opacity: 0.72; margin-top: 4px; }

@media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .glass-card.main { order: -1; grid-column: span 2; } }

/* ====== Block 4-6: 通用区块 ====== */
.block-section { margin: 28px 0; opacity: 0; transform: translateY(20px); transition: all 0.6s ease; }
.block-section:nth-of-type(5) { transition-delay: 0.35s; }
.block-section:nth-of-type(6) { transition-delay: 0.45s; }
.block-section:nth-of-type(7) { transition-delay: 0.55s; }
.block-section.visible { opacity: 1; transform: translateY(0); }

.sec-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 18px; color: var(--text-p); padding-bottom: 10px; border-bottom: 2px solid var(--n-200); }

/* 月度热力图 */
.heatmap-grid {
  display: flex; align-items: flex-end; gap: 6px; height: 140px;
  padding: 0 4px;
}
.heat-cell {
  flex: 1; border-radius: 5px 5px 2px 2px; min-height: 6px;
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 4px; transition: transform 0.2s; position: relative;
}
.heat-cell:hover { transform: scaleY(1.06); }
.cell-month { font-size: 9px; color: white; opacity: 0.8; }
.cell-count { font-size: 9px; color: white; opacity: 0.9; font-weight: 600; }

/* 增强标签云 */
.tag-cloud-enhanced { display: flex; flex-wrap: wrap; gap: 8px; }
.enhanced-tag { border-radius: 16px; color: white; display: inline-flex; gap: 4px; align-items: center; transition: transform 0.2s; line-height: 1.4; }
.enhanced-tag small { opacity: 0.8; font-size: 0.76em; font-weight: 400; }
.enhanced-tag:hover { transform: scale(1.05); }

/* 地点列表 */
.location-list { display: flex; flex-direction: column; gap: 10px; }
.loc-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: var(--n-100); border-radius: 10px; position: relative; overflow: hidden;
}
.loc-rank { width: 24px; height: 24px; border-radius: 50%; background: var(--c-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 700; flex-shrink: 0; }
.loc-name { font-weight: 550; flex-shrink: 0; min-width: 60px; }
.loc-count { color: var(--text-t); font-size: 0.84rem; margin-left: auto; z-index: 1; flex-shrink: 0; }
.loc-bar { position: absolute; left: 0; bottom: 0; top: 0; background: oklch(55% 0.16 75 / 10%); border-radius: 10px; z-index: 0; transition: width 0.8s ease; }
</style>
