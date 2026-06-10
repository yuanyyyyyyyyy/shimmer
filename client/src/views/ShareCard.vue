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
    allPhotos.value = res.data || res.photos || []
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

// 将容器内所有图片转为 base64 data URL（解决 html2canvas 跨域 tainted 问题）
const imagesToDataUrls = async (container) => {
  const imgs = container.querySelectorAll('img')
  const originalSrcs = new Map()
  for (const img of imgs) {
    originalSrcs.set(img, img.src)
    if (!img.src.startsWith('data:')) {
      try {
        const resp = await fetch(img.src, { mode: 'cors', credentials: 'omit' })
        const blob = await resp.blob()
        img.src = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (e) {
        console.warn('图片预加载失败:', img.src, e)
      }
    }
  }
  return originalSrcs
}

// 恢复图片原始 src
const restoreImages = (originalSrcs) => {
  for (const [img, src] of originalSrcs) { img.src = src }
}

// 导出图片
const exportImage = async () => {
  const html2canvas = (await import('html2canvas-pro')).default
  const canvasEl = document.querySelector('.share-preview-ref')
  if (!canvasEl) return

  try {
    // 1. 预先将所有跨域图片转为同源 data URL
    const originalSrcs = await imagesToDataUrls(canvasEl)

    // 2. 调用 html2canvas 渲染（此时无跨域问题）
    const canvas = await html2canvas(canvasEl, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      backgroundColor: '#ffffff'
    })

    // 3. 恢复原始图片 src（保持页面正常显示）
    restoreImages(originalSrcs)

    // 4. 触发下载
    const link = document.createElement('a')
    link.download = `shimmer-share-${createdShareId.value || 'card'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('导出失败:', e)
    alert(`导出失败：${e.message || '未知错误'}，请重试`)
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
        <h1>创建分享卡片</h1>
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
        <div class="step-actions" v-if="selectedIds.length > 0">
          <span class="step-count">已选 {{ selectedIds.length }} 张</span>
          <button class="next-btn" @click="step = 2">
            下一步 →
          </button>
        </div>
      </section>

      <!-- Step 2: 选模板 -->
      <section v-if="step === 2" class="step-section">
        <div class="section-header">
          <h2>选择卡片风格</h2>
          <div class="nav-btns">
            <button @click="step = 1">← 返回</button>
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
        <div class="step-actions">
          <span class="step-count">{{ selectedTemplate }}</span>
          <button class="next-btn" @click="step = 3">下一步 →</button>
        </div>
      </section>

      <!-- Step 3: 编辑文案 -->
      <section v-if="step === 3" class="step-section">
        <div class="section-header">
          <h2>编辑分享内容</h2>
          <div class="nav-btns">
            <button @click="step = 2">← 返回</button>
          </div>
        </div>

        <!-- 预览区 -->
        <div class="edit-layout">
          <div class="edit-form">
            <label>分享文案</label>
            <textarea v-model="customText" rows="4" placeholder="写点什么吧...（可选）" maxlength="200"></textarea>
            <div class="form-hint">
              <button class="ai-gen-btn" @click="generateAiCaption" :disabled="aiCaptionLoading">
                {{ aiCaptionLoading ? 'AI 生成中...' : 'AI 帮我写' }}
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
        <div class="step-actions">
          <span class="step-count">已选 {{ selectedIds.length }} 张</span>
          <button class="next-btn" @click="createShareCard" :disabled="creating">
            {{ creating ? '创建中...' : '创建卡片' }}
          </button>
        </div>
      </section>

      <!-- Step 4: 导出 -->
      <section v-if="step === 4 && createdShareId" class="step-section result-section">
        <h2 style="text-align:center;margin-bottom:20px;">分享卡片已就绪</h2>
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
          <button class="export-primary" @click="exportImage">下载 PNG 图片</button>
          <button class="export-secondary" @click="copyLink">复制链接</button>
          <a :href="`/share/${createdShareId}`" target="_blank" class="export-link">在新窗口查看 ↗</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.share-create-page { max-width: 900px; margin: 0 auto; padding-bottom: 60px; }

.page-head { text-align: center; padding: 28px 0 24px; }
.page-head h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 6px; }
.page-head p { color: var(--text-secondary); font-size: 0.9rem; }

/* 步骤条 */
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 32px; }
.steps > div { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-tertiary); }
.steps > div.active { color: #000; font-weight: 600; }
.steps > div.done { color: #000; }
.steps > div span { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.74rem; font-weight: 700; border: 2px solid var(--n-300); }
.steps > div.active span { background: #000; color: #fff; border-color: #000; }
.steps > div.done span { background: #000; color: #fff; border-color: #000; }
.step-line { width: 36px; height: 1px; background: var(--n-300); margin: 0 4px; }
.step-line.active { background: #000; }

.step-section { animation: fadeUp 0.35s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
.section-header h2 { font-size: 1rem; margin: 0; font-weight: 700; }
.nav-btns { display: flex; gap: 8px; }
.nav-btns button { padding: 6px 16px; border-radius: 16px; border: 1px solid var(--n-300); cursor: pointer; font-size: 0.84rem; background: transparent; color: var(--text-secondary); transition: all 0.2s; }
.nav-btns button:hover { border-color: #000; color: #000; }

/* 底部操作栏（通用） */
.step-actions {
  position: sticky; bottom: 0;
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 20px; padding: 14px 20px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-radius: 14px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
  z-index: 10;
}
.step-count { font-size: 0.84rem; color: var(--text-secondary); }
.next-btn {
  padding: 8px 22px; border-radius: 18px; border: none;
  background: #000; color: #fff;
  font-size: 0.86rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
}
.next-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.next-btn:hover:not(:disabled) { opacity: 0.85; }

/* 照片网格 */
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.photo-item { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s, border-color 0.2s; }
.photo-item:hover { transform: scale(1.03); }
.photo-item.selected { border-color: #000; }
.photo-item img { width: 100%; height: 100%; object-fit: cover; }
.check-badge { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; }

/* 模板选择 */
.tpl-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 600px) { .tpl-list { grid-template-columns: repeat(2, 1fr); } }
.tpl-card { border: 1px solid var(--n-300); border-radius: 12px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s; }
.tpl-card:hover { border-color: #000; }
.tpl-card.active { border-color: #000; background: #f8f8f8; }
.tpl-preview { width: 48px; height: 60px; border-radius: 6px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
.preview-cinematic { background: #111; }
.preview-calendar { background: #f5f5f5; }
.preview-magazine { background: #eee; }
.preview-collage { background: #222; }
.tpl-card strong { display: block; font-size: 0.88rem; margin-bottom: 2px; }
.tpl-card small { font-size: 0.74rem; color: var(--text-tertiary); }

/* 编辑布局 */
.edit-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
@media (max-width: 768px) { .edit-layout { grid-template-columns: 1fr; } }

.edit-form label { display: block; font-size: 0.84rem; font-weight: 600; margin-bottom: 6px; color: var(--text-color); }
.edit-form textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--n-300); border-radius: 8px; resize: vertical; font-size: 0.88rem; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.edit-form textarea:focus { border-color: #000; }
.form-hint { display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.76rem; color: var(--text-tertiary); align-items: center; }
.ai-gen-btn { border: 1px solid var(--n-300); background: transparent; padding: 4px 12px; border-radius: 12px; cursor: pointer; font-size: 0.78rem; color: var(--text-secondary); transition: all 0.2s; }
.ai-gen-btn:hover:not(:disabled) { border-color: #000; color: #000; }

.live-preview-label { font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 6px; }
.live-preview-box { display: flex; justify-content: center; padding: 16px; background: #f8f8f8; border-radius: 12px; overflow-x: auto; }

/* 结果区域 */
.result-section { text-align: center; }
.final-card-wrap { display: inline-block; margin-bottom: 24px; }
.export-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.export-primary, .export-secondary { padding: 10px 24px; border-radius: 20px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.2s; }
.export-primary { background: #000; color: #fff; }
.export-primary:hover { opacity: 0.85; }
.export-secondary { background: #f0f0f0; color: var(--text-secondary); border: 1px solid var(--n-300); }
.export-secondary:hover { border-color: #000; color: #000; }
.export-link { display: inline-flex; align-items: center; padding: 10px 24px; border-radius: 20px; font-size: 0.86rem; color: var(--text-secondary); text-decoration: none; border: 1px solid var(--n-300); transition: all 0.2s; }
.export-link:hover { border-color: #000; color: #000; }
</style>
