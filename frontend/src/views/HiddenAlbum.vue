<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { photos, auth, users } from '../api'
import { useAuthStore } from '../stores'
import { success as showSuccess, error as showError } from '../composables/useToast'
import Lightbox from '../components/Lightbox.vue'

const router = useRouter()
const authStore = useAuthStore()

const verified = ref(false)
const hasPassword = ref(false)
const passwordInput = ref('')
const verifying = ref(false)
const loading = ref(false)
const photoList = ref([])
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => photoList.value.length < total.value)

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

const hiddenToken = ref(sessionStorage.getItem('hidden_album_token') || null)

const checkSession = async () => {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }

  // 检查 sessionStorage 中的 token
  if (hiddenToken.value) {
    try {
      // 验证 token 是否仍然有效（通过尝试获取照片）
      await loadPhotos()
      verified.value = true
      return
    } catch (e) {
      // Token 无效，需要重新验证
      sessionStorage.removeItem('hidden_album_token')
      hiddenToken.value = null
    }
  }

  // 查询是否设置了密码
  try {
    const res = await users.getHiddenPasswordStatus()
    hasPassword.value = res.hasPassword
    if (!hasPassword.value) {
      // 未设置密码，直接获取 token 并展示
      await verifyPassword('')
    }
  } catch (e) {
    console.error(e)
  }
}

const verifyPassword = async (pwd) => {
  verifying.value = true
  try {
    const res = await auth.verifyHiddenPassword(pwd)
    hiddenToken.value = res.token
    sessionStorage.setItem('hidden_album_token', res.token)
    verified.value = true
    await loadPhotos()
    showSuccess('验证成功')
  } catch (e) {
    showError(e.response?.data?.error || '验证失败')
  } finally {
    verifying.value = false
  }
}

const handleSubmitPassword = async () => {
  await verifyPassword(passwordInput.value)
}

const loadPhotos = async () => {
  loading.value = true
  try {
    const res = await photos.getHiddenPhotos({ page: page.value, limit: 20 }, hiddenToken.value)
    photoList.value = res.photos
    total.value = res.pagination.total
  } catch (e) {
    if (e.response?.status === 403) {
      // Token 过期
      sessionStorage.removeItem('hidden_album_token')
      hiddenToken.value = null
      verified.value = false
    }
    throw e
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loading.value) return
  page.value++
  try {
    const res = await photos.getHiddenPhotos({ page: page.value, limit: 20 }, hiddenToken.value)
    photoList.value.push(...res.photos)
    total.value = res.pagination.total
  } catch (e) {
    page.value--
  }
}

const openLightbox = (index) => {
  lightboxIndex.value = index
  lightboxVisible.value = true
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
}

onMounted(checkSession)
</script>

<template>
  <div class="hidden-album">
    <!-- 密码验证弹窗 -->
    <div v-if="!verified && authStore.isLoggedIn" class="verify-overlay">
      <div class="verify-card">
        <div class="lock-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2>隐藏相册</h2>
        <p v-if="hasPassword" class="hint">请输入隐藏相册密码</p>
        <p v-else class="hint">未设置密码，点击进入</p>
        <form v-if="hasPassword" @submit.prevent="handleSubmitPassword" class="password-form">
          <input
            v-model="passwordInput"
            type="password"
            placeholder="输入密码"
            class="password-input"
            autofocus
          />
          <button type="submit" class="btn-enter" :disabled="verifying">
            {{ verifying ? '验证中...' : '进入' }}
          </button>
        </form>
        <button v-else class="btn-enter" @click="verifyPassword('')" :disabled="verifying">
          {{ verifying ? '进入中...' : '进入隐藏相册' }}
        </button>
      </div>
    </div>

    <!-- 照片列表 -->
    <div v-if="verified" class="album-content">
      <div class="album-header">
        <button class="btn-back" @click="router.push('/')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          返回
        </button>
        <h1>隐藏相册</h1>
        <span class="count">{{ total }} 张照片</span>
      </div>

      <div v-if="loading && photoList.length === 0" class="loading">加载中...</div>

      <div v-else-if="photoList.length === 0" class="empty">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>暂无隐藏照片</p>
      </div>

      <div v-else class="photo-grid">
        <div
          v-for="(photo, index) in photoList"
          :key="photo.id"
          class="photo-card"
          @click="openLightbox(index)"
        >
          <div class="photo-img-wrap">
            <img :src="photo.thumbnail_url || photo.url" :alt="photo.title" loading="lazy" />
          </div>
          <div class="photo-info">
            <span class="photo-title" v-if="photo.title">{{ photo.title }}</span>
            <span class="photo-date">{{ formatDate(photo.shot_date) }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasMore" class="load-more">
        <button @click="loadMore" :disabled="loading" class="btn-load-more">
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <Lightbox
      :photos="photoList"
      :start-index="lightboxIndex"
      :visible="lightboxVisible"
      @close="lightboxVisible = false"
    />
  </div>
</template>

<style scoped>
.hidden-album {
  min-height: 100vh;
  padding: 24px;
}

.verify-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.verify-card {
  text-align: center;
  padding: 48px;
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  max-width: 360px;
  width: 100%;
}

.lock-icon {
  color: var(--secondary-color);
  margin-bottom: 24px;
}

.verify-card h2 {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.1em;
  margin: 0 0 12px;
  color: var(--text-primary);
}

.hint {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 24px;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.password-input {
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 16px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.password-input:focus {
  border-color: var(--secondary-color);
}

.btn-enter {
  padding: 12px 24px;
  background: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-enter:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-enter:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.album-content {
  max-width: 960px;
  margin: 0 auto;
}

.album-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-back:hover {
  border-color: var(--secondary-color);
  color: var(--secondary-color);
}

.album-header h1 {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.1em;
  margin: 0;
  color: var(--text-primary);
}

.count {
  color: var(--text-secondary);
  font-size: 14px;
  margin-left: auto;
}

.loading, .empty {
  text-align: center;
  padding: 80px 24px;
  color: var(--text-secondary);
}

.empty svg {
  opacity: 0.3;
  margin-bottom: 16px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.photo-card {
  background: var(--card-bg);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.photo-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.photo-img-wrap {
  aspect-ratio: 1;
  overflow: hidden;
}

.photo-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.photo-title {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.load-more {
  text-align: center;
  padding: 32px;
}

.btn-load-more {
  padding: 10px 24px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-load-more:hover:not(:disabled) {
  border-color: var(--secondary-color);
  color: var(--secondary-color);
}

.btn-load-more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
