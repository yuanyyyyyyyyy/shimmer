<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { share, photos as photoApi } from '../api'
import ShareCardCanvas from '../components/ShareCardCanvas.vue'
import { success as showSuccess } from '../composables/useToast'

const route = useRoute()
const router = useRouter()

// 状态
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
const showPhotoPicker = ref(false)

const templates = [
  { id: 'cinematic', name: '电影海报', icon: '🎬', desc: '大片感叙事' },
  { id: 'calendar', name: '日历风', icon: '📅', desc: '时光记录' },
  { id: 'magazine', name: '杂志风', icon: '📖', desc: '文艺清新' },
  { id: 'collage', name: '拼图风', icon: '🧩', desc: '日常记录' }
]

// 从 URL query 预填
editDate.value = route.query.date || ''
editLocation.value = route.query.location ? decodeURIComponent(route.query.location) : ''

const selectedPhotos = computed(() => allPhotos.value.filter(p => selectedIds.value.includes(p.id)))

const currentTemplateName = computed(() => {
  const t = templates.find(t => t.id === selectedTemplate.value)
  return t ? t.name : ''
})

// 加载用户照片
const loadPhotos = async () => {
  try {
    const res = await photoApi.getMyPhotos({ limit: 120 })
    allPhotos.value = res.data || res.photos || []

    // 如果 URL 中有 photoIds 参数，预选照片
    if (route.query.photoIds) {
      const ids = route.query.photoIds.split(',').map(Number).filter(Boolean)
      selectedIds.value = ids.filter(id => allPhotos.value.some(p => p.id === id))
    }
  } catch (e) { console.error(e) }
}

// 选择/取消照片
const togglePhoto = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const isSelected = (id) => selectedIds.value.includes(id)

// AI 生成文案
const generateAiCaption = async () => {
  aiCaptionLoading.value = true
  try {
    const location = editLocation.value || '某处'
    const count = selectedIds.value.length
    customText.value = `${location}的这一天，光影定格了 ${count} 个美好瞬间。`
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

// 导出图片
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

// 复制链接
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    showSuccess('链接已复制')
  } catch { /* fallback */ }
}

// 完成后跳转到管理页
const goToManage = () => {
  router.push('/shares')
}

onMounted(loadPhotos)
</script>

<template>
  <div class="share-create-page">
    <!-- 顶部操作栏 -->
    <header class="share-header">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回
      </button>
      <h1 class="share-title">分享卡片</h1>
      <div class="header-actions">
        <button v-if="createdShareId" class="header-btn secondary" @click="copyLink">复制链接</button>
        <button v-if="createdShareId" class="header-btn secondary" @click="exportImage">导出 PNG</button>
        <button v-if="!createdShareId" class="header-btn primary" @click="createShareCard" :disabled="creating || selectedIds.length === 0">
          {{ creating ? '创建中...' : '创建分享' }}
        </button>
        <button v-if="createdShareId" class="header-btn primary" @click="goToManage">管理分享</button>
      </div>
    </header>

    <div class="share-body">
      <!-- 左侧控制面板 -->
      <aside class="share-controls">
        <!-- 照片选择 -->
        <div class="control-section">
          <div class="section-header" @click="showPhotoPicker = !showPhotoPicker">
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              选择照片
              <span class="badge" v-if="selectedIds.length > 0">{{ selectedIds.length }}</span>
            </h3>
            <svg class="chevron" :class="{ open: showPhotoPicker }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div v-if="showPhotoPicker" class="photo-picker">
            <div class="photo-grid">
              <div
                v-for="photo in allPhotos"
                :key="photo.id"
                :class="{ selected: isSelected(photo.id) }"
                class="photo-thumb"
                @click="togglePhoto(photo.id)"
              >
                <img :src="photo.thumbnail_url || photo.url" loading="lazy" />
                <div class="check-badge" v-if="isSelected(photo.id)">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 模板选择 -->
        <div class="control-section">
          <div class="section-header">
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              卡片风格
            </h3>
          </div>
          <div class="template-list">
            <button
              v-for="t in templates"
              :key="t.id"
              :class="{ active: selectedTemplate === t.id }"
              class="template-item"
              @click="selectedTemplate = t.id"
            >
              <span class="template-icon">{{ t.icon }}</span>
              <span class="template-name">{{ t.name }}</span>
            </button>
          </div>
        </div>

        <!-- 文字编辑 -->
        <div class="control-section">
          <div class="section-header">
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              编辑内容
            </h3>
          </div>
          <div class="text-editor">
            <textarea v-model="customText" rows="3" placeholder="写点什么吧...（可选）" maxlength="200"></textarea>
            <div class="editor-footer">
              <button class="ai-btn" @click="generateAiCaption" :disabled="aiCaptionLoading">
                {{ aiCaptionLoading ? '生成中...' : 'AI 帮我写' }}
              </button>
              <span class="char-count">{{ customText.length }}/200</span>
            </div>
          </div>
        </div>

        <!-- 日期和地点 -->
        <div class="control-section">
          <div class="field-row">
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
          <div class="field-row">
            <label>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              地点
            </label>
            <input type="text" v-model="editLocation" placeholder="输入地点名称" />
          </div>
        </div>
      </aside>

      <!-- 右侧实时预览 -->
      <main class="share-preview">
        <div class="preview-label">实时预览</div>
        <div class="preview-container">
          <div v-if="selectedPhotos.length === 0" class="empty-preview">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p>选择照片后预览卡片效果</p>
          </div>
          <div v-else class="share-preview-ref">
            <ShareCardCanvas
              :template="selectedTemplate"
              :photos="selectedPhotos"
              :caption="customText"
              :date="editDate"
              :location="editLocation"
            />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.share-create-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

/* 顶部操作栏 */
.share-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #eee;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.back-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.share-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  padding: 7px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.header-btn.primary {
  background: #2f3640;
  color: #fff;
}

.header-btn.primary:hover {
  opacity: 0.9;
}

.header-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.header-btn.secondary {
  background: #f0f0f0;
  color: #555;
}

.header-btn.secondary:hover {
  background: #e5e5e5;
  color: #333;
}

/* 主体布局 */
.share-body {
  flex: 1;
  display: flex;
  gap: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 20px 24px;
}

/* 左侧控制面板 */
.share-controls {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 24px;
}

.control-section {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
}

.section-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.section-header h3 svg {
  color: #888;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #2f3640;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
}

.chevron {
  color: #bbb;
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(180deg);
}

/* 照片选择器 */
.photo-picker {
  padding: 0 12px 12px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.photo-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
}

.photo-thumb:hover {
  transform: scale(1.05);
}

.photo-thumb.selected {
  border-color: #2f3640;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.check-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2f3640;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 模板选择 */
.template-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 0 12px 12px;
}

.template-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.template-item:hover {
  border-color: #ccc;
}

.template-item.active {
  border-color: #2f3640;
  background: #f8f8f8;
}

.template-icon {
  font-size: 20px;
}

.template-name {
  font-size: 11px;
  color: #666;
  font-weight: 500;
}

/* 文字编辑 */
.text-editor {
  padding: 0 12px 12px;
}

.text-editor textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.text-editor textarea:focus {
  border-color: #2f3640;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.ai-btn {
  padding: 4px 10px;
  border: 1px solid #eee;
  border-radius: 12px;
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
  opacity: 0.5;
  cursor: not-allowed;
}

.char-count {
  font-size: 11px;
  color: #bbb;
}

/* 日期和地点 */
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.field-row:not(:last-child) {
  border-bottom: 1px solid #f5f5f5;
}

.field-row label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.field-row input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #eee;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.field-row input:focus {
  border-color: #2f3640;
}

/* 右侧预览区 */
.share-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-label {
  font-size: 12px;
  color: #bbb;
  margin-bottom: 12px;
}

.preview-container {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  min-height: 500px;
}

.empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ccc;
  padding: 60px 20px;
}

.empty-preview p {
  font-size: 13px;
}

.share-preview-ref {
  display: inline-block;
}

/* 响应式 */
@media (max-width: 900px) {
  .share-body {
    flex-direction: column;
    padding: 12px;
  }

  .share-controls {
    width: 100%;
    padding-right: 0;
    order: 2;
  }

  .share-preview {
    order: 1;
    margin-bottom: 16px;
  }

  .preview-container {
    min-height: 300px;
    padding: 16px;
  }

  .template-list {
    grid-template-columns: repeat(4, 1fr);
  }

  .photo-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 480px) {
  .share-header {
    padding: 10px 12px;
  }

  .header-actions {
    gap: 4px;
  }

  .header-btn {
    padding: 6px 10px;
    font-size: 12px;
  }

  .template-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
