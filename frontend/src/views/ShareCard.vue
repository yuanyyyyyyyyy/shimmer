<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { share, photos as photoApi } from '../api'
import { chat } from '../api/chat'
import ShareCardCanvas from '../components/ShareCardCanvas.vue'
import { success as showSuccess } from '../composables/useToast'

const route = useRoute()
const router = useRouter()

const allPhotos = ref([])
const selectedIds = ref([])
const selectedTemplate = ref('cinematic')
const customText = ref('')
const editDate = ref('')
const editLocation = ref('')
const aiCaptionLoading = ref(false)
const creating = ref(false)
const createdShareId = ref(null)
const shareUrl = ref('')
const currentStep = ref(1)

const steps = [
  { id: 1, name: '照片' },
  { id: 2, name: '风格' },
  { id: 3, name: '文案' },
  { id: 4, name: '信息' }
]

const templates = [
  { id: 'cinematic', name: '电影海报', desc: '大片感叙事' },
  { id: 'calendar', name: '日历风', desc: '时光记录' },
  { id: 'magazine', name: '杂志风', desc: '文艺清新' },
  { id: 'collage', name: '拼图风', desc: '日常记录' }
]

editDate.value = route.query.date || ''
editLocation.value = route.query.location ? decodeURIComponent(route.query.location) : ''

const selectedPhotos = computed(() => allPhotos.value.filter(p => selectedIds.value.includes(p.id)))
const isFirstStep = computed(() => currentStep.value === 1)
const isLastStep = computed(() => currentStep.value === 4)
const canNext = computed(() => {
  if (currentStep.value === 1) return selectedIds.value.length > 0
  return true
})

const loadPhotos = async () => {
  try {
    const res = await photoApi.getMyPhotos({ limit: 120 })
    allPhotos.value = res.data || res.photos || []
    if (route.query.photoIds) {
      const ids = route.query.photoIds.split(',').map(Number).filter(Boolean)
      selectedIds.value = ids.filter(id => allPhotos.value.some(p => p.id === id))
    }
  } catch (e) { console.error(e) }
}

const togglePhoto = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const isSelected = (id) => selectedIds.value.includes(id)

const generateAiCaption = async () => {
  aiCaptionLoading.value = true
  try {
    const location = editLocation.value || ''
    const date = editDate.value || ''
    const count = selectedIds.value.length
    const res = await chat.send([{
      role: 'user',
      content: `为一组照片写一句简短的文艺文案。地点：${location || '未知'}，日期：${date || '未知'}，照片数量：${count}。要求：不超过30字，诗意自然，不要标点符号结尾。只输出文案本身，不要其他内容。`
    }])
    const reply = res.data?.reply || res.reply || ''
    if (reply) {
      customText.value = reply.trim()
    } else {
      throw new Error('empty')
    }
  } catch {
    const location = editLocation.value || '某处'
    const count = selectedIds.value.length
    customText.value = `${location}的这一天，光影定格了 ${count} 个美好瞬间。`
  } finally {
    aiCaptionLoading.value = false
  }
}

const prevStep = () => {
  if (currentStep.value > 1) currentStep.value--
}

const nextStep = () => {
  if (currentStep.value < 4 && canNext.value) currentStep.value++
}

const createShareCard = async () => {
  if (selectedIds.value.length === 0) return
  creating.value = true
  try {
    const res = await share.create({
      photoIds: selectedIds.value,
      template: selectedTemplate.value,
      customText: customText.value,
      storyDate: editDate.value || null,
      storyLocation: editLocation.value || null
    })
    createdShareId.value = res.shareId
    shareUrl.value = `${window.location.origin}/share/${res.shareId}`
    showSuccess('分享卡片已创建')
  } catch (e) {
    alert('创建失败: ' + (e.response?.data?.error || e.message))
  } finally {
    creating.value = false
  }
}

const exportImage = async () => {
  const html2canvas = (await import('html2canvas-pro')).default
  const canvasEl = document.querySelector('.share-preview-ref')
  if (!canvasEl) return
  try {
    const imgs = canvasEl.querySelectorAll('img')
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
        } catch (e) { console.warn('图片预加载失败:', img.src) }
      }
    }
    const canvas = await html2canvas(canvasEl, {
      useCORS: true, allowTaint: false, scale: 2, backgroundColor: '#ffffff'
    })
    for (const [img, src] of originalSrcs) { img.src = src }
    const link = document.createElement('a')
    link.download = `shimmer-share-${createdShareId.value || 'card'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('导出失败:', e)
    alert(`导出失败：${e.message || '未知错误'}`)
  }
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    showSuccess('链接已复制')
  } catch { /* fallback */ }
}

onMounted(loadPhotos)
</script>

<template>
  <div class="share-create-page">
    <!-- 页面标题 -->
    <div class="page-top">
      <button class="back-link" @click="router.back()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回
      </button>
      <h1 class="page-title">分享卡片</h1>
    </div>

    <!-- 步骤指示器 -->
    <div class="step-indicator">
      <template v-for="(s, i) in steps" :key="s.id">
        <div :class="['step-dot', { active: currentStep === s.id, done: currentStep > s.id }]">
          <svg v-if="currentStep > s.id" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span v-else>{{ s.id }}</span>
        </div>
        <span :class="['step-label', { active: currentStep === s.id }]">{{ s.name }}</span>
        <div v-if="i < steps.length - 1" :class="['step-line', { filled: currentStep > s.id }]"></div>
      </template>
    </div>

    <!-- 主体分栏 -->
    <div class="main-split">
      <!-- 左侧：步骤内容 -->
      <div class="steps-col">
        <!-- Step 1: 照片选择 -->
        <div v-if="currentStep === 1" class="step-panel" key="step1">
          <p class="section-hint">选择要包含在卡片中的照片</p>
          <div class="photo-grid">
            <div
              v-for="photo in allPhotos"
              :key="photo.id"
              :class="{ selected: isSelected(photo.id) }"
              class="photo-thumb"
              @click="togglePhoto(photo.id)"
            >
              <img :src="photo.thumbnail_url || photo.url" loading="lazy" />
              <div class="check-mark" v-if="isSelected(photo.id)">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
          </div>
          <p class="empty-hint" v-if="allPhotos.length === 0">暂无照片，请先上传</p>
        </div>

        <!-- Step 2: 模板选择 -->
        <div v-if="currentStep === 2" class="step-panel" key="step2">
          <p class="section-hint">选择卡片风格</p>
          <div class="template-grid">
            <button
              v-for="t in templates"
              :key="t.id"
              :class="['template-card', { active: selectedTemplate === t.id }]"
              @click="selectedTemplate = t.id"
            >
              <svg v-if="t.id === 'cinematic'" class="tpl-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 7l-7 5 7 5V7z"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <svg v-else-if="t.id === 'calendar'" class="tpl-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <svg v-else-if="t.id === 'magazine'" class="tpl-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <svg v-else class="tpl-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span class="tpl-name">{{ t.name }}</span>
              <span class="tpl-desc">{{ t.desc }}</span>
            </button>
          </div>
        </div>

        <!-- Step 3: 文案编辑 -->
        <div v-if="currentStep === 3" class="step-panel" key="step3">
          <p class="section-hint">为卡片添加文字描述</p>
          <div class="editor-wrap">
            <textarea
              v-model="customText"
              rows="4"
              placeholder="写点什么吧..."
              maxlength="200"
            ></textarea>
            <div class="editor-footer">
              <button class="ai-btn" @click="generateAiCaption" :disabled="aiCaptionLoading">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                {{ aiCaptionLoading ? '生成中...' : 'AI 帮我写' }}
              </button>
              <span class="char-count">{{ customText.length }}/200</span>
            </div>
          </div>
        </div>

        <!-- Step 4: 日期和地点 -->
        <div v-if="currentStep === 4" class="step-panel" key="step4">
          <p class="section-hint">填写日期和地点信息</p>
          <div class="info-fields">
            <div class="field-item">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                日期
              </label>
              <input type="text" v-model="editDate" placeholder="2024.03.15" />
            </div>
            <div class="field-item">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                地点
              </label>
              <input type="text" v-model="editLocation" placeholder="输入地点" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：预览 -->
      <div class="preview-col">
        <div class="preview-sticky">
          <div v-if="selectedPhotos.length === 0" class="empty-preview">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>选择照片后预览</span>
          </div>
          <div v-else class="share-preview-ref">
          <ShareCardCanvas
            :template="selectedTemplate"
            :photos="selectedPhotos"
            :caption="customText"
            :date="editDate"
            :location="editLocation"
            :scale="0.55"
          />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部导航栏 -->
    <div class="bottom-bar">
      <div class="bottom-inner">
        <span class="step-info">步骤 {{ currentStep }}/4</span>
        <div class="bottom-actions">
          <template v-if="createdShareId">
            <button class="btn ghost" @click="copyLink">复制链接</button>
            <button class="btn ghost" @click="exportImage">导出 PNG</button>
            <router-link to="/shares" class="btn solid">管理分享</router-link>
          </template>
          <template v-else>
            <button v-if="!isFirstStep" class="btn ghost" @click="prevStep">上一步</button>
            <button v-if="!isLastStep" class="btn solid" @click="nextStep" :disabled="!canNext">下一步</button>
            <button v-else class="btn solid" @click="createShareCard" :disabled="creating">
              {{ creating ? '创建中...' : '创建分享' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-create-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
  padding-bottom: 72px;
}

/* 页面标题 */
.page-top {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0 12px;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: none;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s;
}

.back-link:hover {
  color: #333;
}

.page-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

/* 步骤指示器 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0 16px;
}

.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #bbb;
  background: #fff;
  transition: all 0.25s;
  flex-shrink: 0;
}

.step-dot.active {
  border-color: #2f3640;
  background: #2f3640;
  color: #fff;
}

.step-dot.done {
  border-color: #2f3640;
  background: #2f3640;
  color: #fff;
}

.step-label {
  font-size: 11px;
  color: #bbb;
  margin: 0 10px;
  transition: color 0.2s;
  white-space: nowrap;
}

.step-label.active {
  color: #2f3640;
  font-weight: 500;
}

.step-line {
  width: 40px;
  height: 1.5px;
  background: #eee;
  margin: 0 2px;
  transition: background 0.25s;
  flex-shrink: 0;
}

.step-line.filled {
  background: #2f3640;
}

/* 主体分栏 */
.main-split {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* 左侧步骤列 */
.steps-col {
  flex: 1;
  min-width: 0;
  padding-bottom: 20px;
  max-width: 520px;
  margin: 0 auto;
}

.section-hint {
  font-size: 13px;
  color: #999;
  margin: 0 0 14px;
}

.step-panel {
  animation: panelIn 0.2s ease;
}

@keyframes panelIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 照片网格 */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.photo-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
}

.photo-thumb:hover {
  transform: scale(1.04);
}

.photo-thumb.selected {
  border-color: #2f3640;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.check-mark {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2f3640;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.empty-hint {
  text-align: center;
  color: #ccc;
  font-size: 13px;
  padding: 48px 0;
}

/* 模板选择 */
.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 10px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.template-card:hover {
  border-color: #ddd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.template-card.active {
  border-color: #2f3640;
  box-shadow: 0 0 0 1px #2f3640;
  background: #fafafa;
}

.tpl-icon {
  color: #888;
  transition: color 0.15s;
}

.template-card.active .tpl-icon {
  color: #2f3640;
}

.tpl-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.tpl-desc {
  font-size: 11px;
  color: #aaa;
}

/* 文案编辑 */
.editor-wrap textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  line-height: 1.7;
  color: #333;
}

.editor-wrap textarea:focus {
  border-color: #2f3640;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.ai-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 1px solid #eee;
  border-radius: 14px;
  background: #fff;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-btn:hover:not(:disabled) {
  border-color: #2f3640;
  color: #333;
}

.ai-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.char-count {
  font-size: 11px;
  color: #ccc;
}

/* 日期和地点 */
.info-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-item label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #888;
  margin-bottom: 6px;
}

.field-item input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  color: #333;
}

.field-item input:focus {
  border-color: #2f3640;
}

/* 右侧预览列 */
.preview-col {
  width: 320px;
  flex-shrink: 0;
}

.preview-sticky {
  position: sticky;
  top: 60px;
}

.empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #ccc;
  padding: 60px 20px;
  background: #fff;
  border: 1px dashed #e0e0e0;
  border-radius: 16px;
}

.empty-preview span {
  font-size: 13px;
}

.share-preview-ref {
  display: inline-block;
}

/* 底部导航栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.bottom-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-info {
  font-size: 13px;
  color: #999;
}

.bottom-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}

.btn.solid {
  background: #2f3640;
  color: #fff;
}

.btn.solid:hover {
  opacity: 0.9;
}

.btn.solid:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn.ghost {
  background: transparent;
  color: #666;
  border: 1px solid #eee;
}

.btn.ghost:hover {
  background: #f5f5f5;
  color: #333;
}

/* 响应式 */
@media (max-width: 900px) {
  .main-split {
    flex-direction: column;
    gap: 24px;
  }

  .preview-col {
    width: 100%;
    order: -1;
  }

  .preview-sticky {
    position: static;
    display: flex;
    justify-content: center;
  }

  .share-preview-ref {
    display: flex;
    justify-content: center;
  }

  .empty-preview {
    padding: 40px 20px;
  }
}

@media (max-width: 700px) {
  .share-create-page {
    padding: 0 16px;
    padding-bottom: 72px;
  }

  .step-line {
    width: 24px;
  }

  .step-label {
    font-size: 10px;
    margin: 0 6px;
  }

  .template-grid {
    grid-template-columns: 1fr;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 6px;
  }

  .bottom-inner {
    padding: 10px 16px;
  }

  .btn {
    padding: 7px 14px;
    font-size: 12px;
  }
}
</style>
