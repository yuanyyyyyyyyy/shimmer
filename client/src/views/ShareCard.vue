<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { share, photos as photoApi } from '../api'
import ShareCardCanvas from '../components/ShareCardCanvas.vue'

const route = useRoute()

// 状态
const step = ref(1) // 1=选照片, 2=选模板, 3=编辑文案, 4=预览导出
const allPhotos = ref([])
const selectedIds = ref([])
const templates = [
  { id: 'cinematic', name: '电影海报', desc: '大片感叙事' },
  { id: 'calendar', name: '日历风', desc: '时光记录' },
  { id: 'magazine', name: '杂志风', desc: '文艺清新' },
  { id: 'collage', name: '拼图风', desc: '日常记录' }
]
const selectedTemplate = ref('cinematic')
const customText = ref('')
const aiCaptionLoading = ref(false)
const creating = ref(false)
const createdShareId = ref(null)
const shareUrl = ref('')

// 从故事线跳转时预填信息
const storyDate = route.query.date || ''
const storyLocation = route.query.location ? decodeURIComponent(route.query.location) : ''

// 加载用户照片
const loadPhotos = async () => {
  try {
    const res = await photoApi.getMyPhotos({ limit: 60 })
    allPhotos.value = res.photos || res || []
  } catch (e) { console.error(e) }
}

// 选择/取消照片
const togglePhoto = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const isSelected = (id) => selectedIds.value.includes(id)

const selectedPhotos = () => allPhotos.value.filter(p => selectedIds.value.includes(p.id))

// AI 生成文案
const generateAiCaption = async () => {
  aiCaptionLoading.value = true
  try {
    // 使用 AI 接口生成（这里简化为模拟，实际可调用后端接口）
    const pics = selectedPhotos().map(p => ({ title: p.title }))
    customText.value = `${storyLocation || '某处'}的这一天，光影定格了 ${selectedIds.value.length} 个美好瞬间。`
  } finally {
    aiCaptionLoading.value = false
  }
}

// 创建分享卡片
const createShareCard = async () => {
  if (selectedIds.value.length === 0) return
  creating.value = true
  try {
    const res = await share.create({
      photoIds: selectedIds.value,
      template: selectedTemplate.value,
      customText: customText.value,
      storyDate: storyDate,
      storyLocation: storyLocation
    })
    createdShareId.value = res.shareId
    shareUrl.value = `${window.location.origin}/share/${res.shareId}`
    step.value = 4
  } catch (e) {
    alert('创建失败: ' + (e.response?.data?.error || e.message))
  } finally {
    creating.value = false
  }
}

// 导出图片
const exportImage = async () => {
  // 动态导入 html2canvas
  const html2canvas = (await import('html2canvas')).default
  const canvasEl = document.querySelector('.share-preview-ref')
  if (!canvasEl) return

  try {
    const canvas = await html2canvas(canvasEl, {
      useCORS: true,
      scale: 2,
      backgroundColor: '#ffffff'
    })
    const link = document.createElement('a')
    link.download = `shimmer-share-${createdShareId.value}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('导出失败:', e)
    alert('导出失败，请重试')
  }
}

// 复制链接
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    alert('链接已复制！')
  } catch { /* fallback */ }
}

onMounted(loadPhotos)
</script>

<template>
  <div class="share-create-page">
    <div class="container">
      <header class="page-head">
        <h1>✨ 创建分享卡片</h1>
        <p>将你的光影瞬间变成精美的分享卡片</p>
      </header>

      <!-- 步骤条 -->
      <div class="steps">
        <div :class="{ active: step >= 1, done: step > 1 }"><span>1</span><small>选照片</small></div>
        <div class="step-line" :class="{ active: step > 1 }"></div>
        <div :class="{ active: step >= 2, done: step > 2 }"><span>2</span><small>选模板</small></div>
        <div class="step-line" :class="{ active: step > 2 }"></div>
        <div :class="{ active: step >= 3, done: step > 3 }"><span>3</span><small>编辑</small></div>
        <div class="step-line" :class="{ active: step > 3 }"></div>
        <div :class="{ active: step >= 4 }"><span>4</span><small>导出</small></div>
      </div>

      <!-- Step 1: 选照片 -->
      <section v-if="step === 1" class="step-section">
        <div class="section-header">
          <h2>选择照片（已选 {{ selectedIds.length }} 张）</h2>
          <button v-if="selectedIds.length > 0" class="next-btn" @click="step = 2" :disabled="selectedIds.length === 0">
            下一步 →
          </button>
        </div>
        <div class="photo-grid">
          <div
            v-for="photo in allPhotos"
            :key="photo.id"
            :class="{ selected: isSelected(photo.id) }"
            class="photo-item"
            @click="togglePhoto(photo.id)"
          >
            <img :src="photo.thumbnail_url || photo.url" loading="lazy" />
            <div class="check-badge" v-if="isSelected(photo.id)">✓</div>
          </div>
        </div>
      </section>

      <!-- Step 2: 选模板 -->
      <section v-if="step === 2" class="step-section">
        <div class="section-header">
          <h2>选择卡片风格</h2>
          <div class="nav-btns">
            <button @click="step = 1">← 返回</button>
            <button class="next-btn" @click="step = 3">下一步 →</button>
          </div>
        </div>
        <div class="tpl-list">
          <div
            v-for="t in templates"
            :key="t.id"
            :class="{ active: selectedTemplate === t.id }"
            class="tpl-card"
            @click="selectedTemplate = t.id"
          >
            <div class="tpl-preview" :class="`preview-${t.id}`">
              <span class="tpl-icon">{{ { cinematic: '🎬', calendar: '📅', magazine: '📖', collage: '🧩' }[t.id] }}</span>
            </div>
            <strong>{{ t.name }}</strong>
            <small>{{ t.desc }}</small>
          </div>
        </div>
      </section>

      <!-- Step 3: 编辑文案 -->
      <section v-if="step === 3" class="step-section">
        <div class="section-header">
          <h2>编辑分享内容</h2>
          <div class="nav-btns">
            <button @click="step = 2">← 返回</button>
            <button class="primary-btn" @click="createShareCard" :disabled="creating || selectedIds.length === 0">
              {{ creating ? '创建中...' : '创建卡片 →' }}
            </button>
          </div>
        </div>

        <!-- 预览区 -->
        <div class="edit-layout">
          <div class="edit-form">
            <label>分享文案</label>
            <textarea v-model="customText" rows="4" placeholder="写点什么吧...（可选）" maxlength="200"></textarea>
            <div class="form-hint">
              <button class="ai-gen-btn" @click="generateAiCaption" :disabled="aiCaptionLoading">
                {{ aiCaptionLoading ? 'AI 生成中...' : 'AI 帮我写 ✨' }}
              </button>
              <span>{{ customText.length }}/200</span>
            </div>
          </div>
          <div class="live-preview-label">实时预览</div>
          <div class="live-preview-box">
            <ShareCardCanvas
              :template="selectedTemplate"
              :photos="selectedPhotos()"
              :caption="customText"
              :date="storyDate"
              :location="storyLocation"
            />
          </div>
        </div>
      </section>

      <!-- Step 4: 导出 -->
      <section v-if="step === 4 && createdShareId" class="step-section result-section">
        <h2 style="text-align:center;margin-bottom:20px;">🎉 分享卡片已就绪！</h2>
        <div class="final-card-wrap">
          <div class="share-preview-ref">
            <ShareCardCanvas
              :template="selectedTemplate"
              :photos="selectedPhotos()"
              :caption="customText"
              :date="storyDate"
              :location="storyLocation"
            />
          </div>
        </div>
        <div class="export-actions">
          <button class="export-primary" @click="exportImage">📥 下载 PNG 图片</button>
          <button class="export-secondary" @click="copyLink">🔗 复制链接</button>
          <a :href="`/share/${createdShareId}`" target="_blank" class="export-link">在新窗口查看 ↗</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.share-create-page { max-width: 900px; margin: 0 auto; padding-bottom: 60px; }

.page-head { text-align: center; padding: 28px 0 24px; }
.page-head h1 { font-size: 1.7rem; font-weight: 800; margin-bottom: 6px; }
.page-head p { color: var(--text-secondary); font-size: 0.93rem; }

/* 步骤条 */
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 32px; }
.steps > div { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--text-tertiary); }
.steps > div.active { color: var(--color-primary); font-weight: 600; }
.steps > div.done { color: oklch(62% 0.13 155); }
.steps > div span { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 700; border: 2px solid var(--n-300); }
.steps > div.active span { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.steps > div.done span { background: oklch(62% 0.13 155); color: white; border-color: oklch(62% 0.13 155); }
.step-line { width: 40px; height: 2px; background: var(--n-300); margin: 0 4px; }
.step-line.active { background: var(--color-primary); }

.step-section { animation: fadeUp 0.35s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
.section-header h2 { font-size: 1.08rem; margin: 0; }
.nav-btns { display: flex; gap: 8px; }
.next-btn, .nav-btns button { padding: 7px 18px; border-radius: 18px; border: none; cursor: pointer; font-size: 0.86rem; }
.next-btn, .primary-btn { background: var(--color-primary); color: white; }
.next-btn:disabled, .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.nav-btns button:first-child { background: var(--n-200); color: var(--text-secondary); }

/* 照片网格 */
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.photo-item { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; cursor: pointer; border: 3px solid transparent; transition: transform 0.2s, border-color 0.2s; }
.photo-item:hover { transform: scale(1.04); }
.photo-item.selected { border-color: var(--color-primary); }
.photo-item img { width: 100%; height: 100%; object-fit: cover; }
.check-badge { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; }

/* 模板选择 */
.tpl-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 600px) { .tpl-list { grid-template-columns: repeat(2, 1fr); } }
.tpl-card { border: 2px solid var(--n-200); border-radius: 14px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s; }
.tpl-card:hover { border-color: oklch(55% 0.10 75); }
.tpl-card.active { border-color: var(--color-primary); background: oklch(97% 0.008 75); box-shadow: 0 4px 16px oklch(55% 0.16 75 / 12%); }
.tpl-preview { width: 56px; height: 68px; border-radius: 8px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; }
.preview-cinematic { background: linear-gradient(135deg, #111, #333); }
.preview-calendar { background: linear-gradient(135deg, #fef9e8, #fce8b8); }
.preview-magazine { background: linear-gradient(135deg, #f8f8ff, #e8ecfc); }
.preview-collage { background: linear-gradient(135deg, #222, #444); }
.tpl-card strong { display: block; font-size: 0.92rem; margin-bottom: 2px; }
.tpl-card small { font-size: 0.76rem; color: var(--text-tertiary); }

/* 编辑布局 */
.edit-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start; }
@media (max-width: 768px) { .edit-layout { grid-template-columns: 1fr; } }

.edit-form label { display: block; font-size: 0.88rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); }
.edit-form textarea { width: 100%; padding: 12px; border: 1px solid var(--n-300); border-radius: 10px; resize: vertical; font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.2s; }
.edit-form textarea:focus { border-color: var(--color-primary); }
.form-hint { display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.78rem; color: var(--text-tertiary); align-items: center; }
.ai-gen-btn { background: linear-gradient(135deg, oklch(94% 0.03 75), oklch(96% 0.02 250)); border: 1px dashed oklch(55% 0.10 75 / 40%); padding: 5px 14px; border-radius: 14px; cursor: pointer; font-size: 0.8rem; color: oklch(45% 0.12 75); transition: all 0.2s; }
.ai-gen-btn:hover:not(:disabled) { background: oklch(90% 0.04 75); }

.live-preview-label { font-size: 0.82rem; color: var(--text-tertiary); margin-bottom: 8px; }
.live-preview-box { display: flex; justify-content: center; padding: 20px; background: var(--n-100); border-radius: 16px; overflow-x: auto; }

/* 结果区域 */
.result-section { text-align: center; }
.final-card-wrap { display: inline-block; margin-bottom: 28px; }
.export-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.export-primary, .export-secondary { padding: 11px 28px; border-radius: 24px; font-size: 0.92rem; font-weight: 600; cursor: pointer; border: none; transition: filter 0.2s; }
.export-primary { background: var(--color-primary); color: white; }
.export-primary:hover { filter: brightness(1.07); }
.export-secondary { background: var(--n-200); color: var(--text-secondary); }
.export-secondary:hover { background: var(--n-300); }
.export-link { display: inline-flex; align-items: center; padding: 11px 28px; border-radius: 24px; font-size: 0.92rem; color: oklch(52% 0.12 250); text-decoration: none; border: 1px solid oklch(85% 0.05 250); transition: all 0.2s; }
.export-link:hover { background: oklch(97% 0.008 250); }
</style>
