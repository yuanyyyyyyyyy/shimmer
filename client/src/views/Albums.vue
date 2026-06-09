<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { albums } from '../api'
import { useAuthStore } from '../stores'
import { success, error } from '../composables/useToast'

const router = useRouter()
const authStore = useAuthStore()

const albumList = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)

// 新相册表单
const newAlbum = ref({
  title: '',
  description: '',
  is_public: true
})

// 加载相册列表
const loadAlbums = async () => {
  if (loading.value) return
  loading.value = true

  try {
    const res = await albums.list({
      limit: 100,
      user_id: authStore.isLoggedIn ? authStore.user?.id : null
    })
    albumList.value = res.albums || []
  } catch (err) {
    error(err.message || '加载相册失败')
  } finally {
    loading.value = false
  }
}

// 创建相册
const createAlbum = async () => {
  if (!newAlbum.value.title.trim()) {
    error('请输入相册标题')
    return
  }

  try {
    const res = await albums.create(newAlbum.value)
    success('相册创建成功')
    showCreateDialog.value = false
    newAlbum.value = { title: '', description: '', is_public: true }
    // 跳转到相册详情
    router.push(`/albums/${res.album.id}`)
  } catch (err) {
    error(err.message || '创建相册失败')
  }
}

// 删除相册
const deleteAlbum = async (album) => {
  if (!confirm(`确定要删除相册"${album.title}"吗？`)) return

  try {
    await albums.delete(album.id)
    success('相册已删除')
    loadAlbums()
  } catch (err) {
    error(err.message || '删除失败')
  }
}

// 查看相册详情
const viewAlbum = (album) => {
  router.push(`/albums/${album.id}`)
}

onMounted(() => {
  loadAlbums()
})
</script>

<template>
  <div class="albums-page">
    <!-- 页面标题栏 -->
    <div class="page-header">
      <h1 class="page-title">相册</h1>
      <button
        v-if="authStore.isLoggedIn"
        class="btn-primary"
        @click="showCreateDialog = true"
      >
        <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建相册
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中</p>
    </div>

    <!-- 相册列表 -->
    <div v-else-if="albumList.length > 0" class="albums-grid">
      <article
        v-for="album in albumList"
        :key="album.id"
        class="album-card"
        @click="viewAlbum(album)"
      >
        <!-- 封面 -->
        <div class="album-cover">
          <img
            v-if="album.cover_url"
            :src="album.cover_url"
            :alt="album.title"
            loading="lazy"
          >
          <div v-else class="no-cover">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <span class="photo-count">{{ album.photo_count || 0 }}</span>
        </div>

        <!-- 信息 -->
        <div class="album-body">
          <h3 class="album-title">{{ album.title }}</h3>
          <p v-if="album.description" class="album-desc">{{ album.description }}</p>
          <div class="album-meta">
            <span class="meta-author">{{ album.nickname || album.username }}</span>
            <span class="meta-badge" :class="album.is_public ? 'is-public' : 'is-private'">
              {{ album.is_public ? '公开' : '私有' }}
            </span>
          </div>

          <!-- 操作按钮 -->
          <div
            v-if="authStore.isLoggedIn && authStore.user?.id === album.user_id"
            class="album-actions"
            @click.stop
          >
            <button class="btn-ghost btn-danger" @click="deleteAlbum(album)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              删除
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-illustration">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <h3 class="empty-title">还没有相册</h3>
      <p class="empty-desc">创建第一个相册，开始整理你的光影记忆</p>
      <button
        v-if="authStore.isLoggedIn"
        class="btn-primary"
        @click="showCreateDialog = true"
      >
        <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        创建相册
      </button>
    </div>

    <!-- 创建相册对话框 -->
    <Teleport to="body">
      <div v-if="showCreateDialog" class="modal-backdrop" @click.self="showCreateDialog = false">
        <div class="modal-panel">
          <header class="modal-header">
            <h2>新建相册</h2>
            <button class="btn-icon" @click="showCreateDialog = false" aria-label="关闭">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>
          <form @submit.prevent="createAlbum">
            <div class="field">
              <label for="album-title">名称</label>
              <input
                id="album-title"
                v-model="newAlbum.title"
                type="text"
                placeholder="给相册起个名字"
                maxlength="100"
                required
                autocomplete="off"
              >
            </div>

            <div class="field">
              <label for="album-desc">描述 <span class="optional">(可选)</span></label>
              <textarea
                id="album-desc"
                v-model="newAlbum.description"
                placeholder="简单描述这个相册的内容"
                rows="3"
              ></textarea>
            </div>

            <div class="field field-checkbox">
              <label class="toggle-label">
                <input v-model="newAlbum.is_public" type="checkbox">
                <span class="toggle-custom"></span>
                <span>公开相册</span>
              </label>
              <p class="field-hint">其他用户可以浏览此相册</p>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-text" @click="showCreateDialog = false">取消</button>
              <button type="submit" class="btn-primary">创建</button>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ========== Design Tokens ========== */
.albums-page {
  --color-accent: var(--secondary-color, #3498db);
  --color-surface: var(--card-bg, #fff);
  --color-bg: var(--bg-color, #fafafa);
  --color-text: var(--text-color, #1a1a1a);
  --color-muted: var(--text-secondary, #666);
  --color-faint: var(--text-tertiary, #999);
  --color-border: oklch(90% 0.008 250);
  --color-border-hover: oklch(80% 0.015 250);
  --color-danger: oklch(55% 0.18 25);
  --color-danger-hover: oklch(48% 0.20 25);
  --color-success: oklch(60% 0.14 155);
  --color-no-cover: oklch(93% 0.015 250);

  max-width: 1120px;
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3rem);
}

/* Dark mode overrides */
:global(.dark) .albums-page {
  --color-border: oklch(25% 0.01 250);
  --color-border-hover: oklch(32% 0.015 250);
  --color-no-cover: oklch(22% 0.015 250);
}

/* ========== Page Header ========== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1.75rem, 3vw, 2.5rem);
  gap: 1rem;
}

.page-title {
  font-size: clamp(1.5rem, 3vw, 1.875rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin: 0;
}

/* ========== Button System ========== */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s cubic-bezier(0.33, 1, 0.68, 1), transform 0.15s cubic-bezier(0.33, 1, 0.68, 1);
  white-space: nowrap;
}

.btn-primary:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary .icon {
  flex-shrink: 0;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: transparent;
  border: none;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  color: var(--color-muted);
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.btn-ghost:hover {
  background: oklch(95% 0.02 25);
  color: var(--color-danger);
}

.btn-ghost.btn-danger:hover {
  background: oklch(96% 0.03 25);
}

.btn-text {
  background: transparent;
  border: none;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-muted);
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.btn-text:hover {
  background: oklch(95% 0.008 250);
  color: var(--color-text);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-faint);
  transition: all 0.15s cubic-bezier(0.33, 1, 0.68, 1);
}

.btn-icon:hover {
  background: oklch(95% 0.008 250);
  color: var(--color-text);
}

/* ========== Loading State ========== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
  gap: 1rem;
  color: var(--color-muted);
  font-size: 0.875rem;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== Album Grid ========== */
.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}

/* ========== Album Card ========== */
.album-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.33, 1, 0.68, 1),
              box-shadow 0.25s cubic-bezier(0.33, 1, 0.68, 1),
              border-color 0.2s ease;
}

.album-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px oklch(0% 0 0 / 0.08);
  border-color: var(--color-border-hover);
}

/* Cover area */
.album-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-no-cover);
}

.album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1);
}

.album-card:hover .album-cover img {
  transform: scale(1.03);
}

.no-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: oklch(50% 0.04 250);
}

.photo-count {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: oklch(20% 0 0 / 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  line-height: 1.4;
}

/* Card body */
.album-body {
  padding: 1rem 1.125rem 1.125rem;
}

.album-title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-text);
  margin: 0 0 0.375rem;
  line-height: 1.35;
}

.album-desc {
  font-size: 0.8125rem;
  color: var(--color-muted);
  line-height: 1.55;
  margin: 0 0 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.album-meta {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.75rem;
  color: var(--color-faint);
}

.meta-author {
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.6;
}

.meta-badge.is-public {
  background: oklch(94% 0.04 155);
  color: oklch(40% 0.14 155);
}

.meta-badge.is-private {
  background: oklch(94% 0.01 250);
  color: var(--color-faint);
}

/* Card actions */
.album-actions {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

/* ========== Empty State ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 5rem 1.5rem;
}

.empty-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: var(--color-bg);
  color: var(--color-faint);
  margin-bottom: 1.25rem;
}

.empty-title {
  font-size: 1.175rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.375rem;
}

.empty-desc {
  font-size: 0.875rem;
  color: var(--color-muted);
  margin: 0 0 1.5rem;
  max-width: 280px;
  line-height: 1.55;
}

/* ========== Modal ========== */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: oklch(0% 0 0 / 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-panel {
  width: 100%;
  max-width: 440px;
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 20px 60px oklch(0% 0 0 / 0.15);
  animation: slideUp 0.25s cubic-bezier(0.33, 1, 0.68, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0;
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.modal-panel form {
  padding: 1.25rem 1.5rem 1.5rem;
}

.field {
  margin-bottom: 1.125rem;
}

.field:last-of-type {
  margin-bottom: 0;
}

.field > label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.optional {
  font-weight: 400;
  color: var(--color-faint);
}

.field input[type="text"],
.field textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color 0.2s ease, box-shadow 0.15s ease;
  outline: none;
}

.field input[type="text"]:focus,
.field textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px oklch(90% 0.06 var(--color-accent));
}

.field input[type="text"]::placeholder,
.field textarea::placeholder {
  color: var(--color-faint);
}

.field textarea {
  resize: vertical;
  min-height: 72px;
}

/* Checkbox toggle */
.field-checkbox {
  padding: 0.75rem 0;
}

.toggle-label {
  display: inline-flex !important;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-text);
}

.toggle-label input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 0;
  height: 0;
  position: absolute;
  opacity: 0;
}

.toggle-custom {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--color-border);
  border-radius: 10px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-custom::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.15);
  transition: transform 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.toggle-label input:checked + .toggle-custom {
  background: var(--color-accent);
}

.toggle-label input:checked + .toggle-custom::after {
  transform: translateX(16px);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-faint);
  margin: 0.375rem 0 0 2.625rem;
}

/* Modal footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

/* ========== Responsive ========== */
@media (max-width: 640px) {
  .albums-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-primary {
    align-self: stretch;
    justify-content: center;
  }

  .modal-panel {
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
  }
}
</style>
