<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { share } from '../api'
import { success as showSuccess, error as showError } from '../composables/useToast'

const router = useRouter()

const shares = ref([])
const loading = ref(true)
const deletingId = ref(null)

const templateNames = {
  cinematic: '电影海报',
  calendar: '日历风',
  magazine: '杂志风',
  collage: '拼图风'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const timeAgo = (dateStr) => {
  const now = new Date()
  const d = new Date(dateStr)
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  return formatDate(dateStr)
}

const loadShares = async () => {
  loading.value = true
  try {
    const res = await share.list({ limit: 50 })
    shares.value = res.shares || []
  } catch (e) {
    console.error('加载分享列表失败:', e)
  } finally {
    loading.value = false
  }
}

const viewShare = (shareId) => {
  window.open(`/share/${shareId}`, '_blank')
}

const copyLink = async (shareId) => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${shareId}`)
    showSuccess('链接已复制')
  } catch { /* fallback */ }
}

const deleteShare = async (shareItem) => {
  if (!confirm(`确定要删除这个分享卡片吗？`)) return
  deletingId.value = shareItem.shareId
  try {
    await share.delete(shareItem.shareId)
    shares.value = shares.value.filter(s => s.shareId !== shareItem.shareId)
    showSuccess('已删除')
  } catch (e) {
    showError('删除失败: ' + (e.response?.data?.error || e.message))
  } finally {
    deletingId.value = null
  }
}

const goToCreate = () => {
  router.push('/share/create')
}

onMounted(loadShares)
</script>

<template>
  <div class="share-manage-page">
    <header class="page-header">
      <div class="header-left">
        <h1>我的分享</h1>
        <span class="count" v-if="!loading">{{ shares.length }} 个分享卡片</span>
      </div>
      <button class="create-btn" @click="goToCreate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建分享
      </button>
    </header>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="shares.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      </div>
      <p class="empty-title">还没有分享卡片</p>
      <p class="empty-desc">创建一个分享卡片，把你的精彩瞬间分享给朋友</p>
      <button class="create-btn" @click="goToCreate">创建第一个分享</button>
    </div>

    <!-- 分享列表 -->
    <div v-else class="share-list">
      <div v-for="item in shares" :key="item.shareId" class="share-card">
        <div class="card-cover">
          <img
            v-if="item.coverPhoto"
            :src="item.coverPhoto.thumbnail_url || item.coverPhoto.url"
            alt=""
          />
          <div v-else class="no-cover">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        </div>
        <div class="card-info">
          <div class="card-top">
            <span class="template-badge">{{ templateNames[item.template] || item.template }}</span>
            <span class="photo-count">{{ item.photoCount }} 张照片</span>
          </div>
          <div class="card-meta" v-if="item.storyDate || item.storyLocation">
            <span v-if="item.storyDate">{{ item.storyDate }}</span>
            <span v-if="item.storyLocation">· {{ item.storyLocation }}</span>
          </div>
          <div class="card-bottom">
            <span class="view-count">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {{ item.viewCount }}
            </span>
            <span class="time-ago">{{ timeAgo(item.createdAt) }}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="action-btn" @click="viewShare(item.shareId)" title="查看">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          <button class="action-btn" @click="copyLink(item.shareId)" title="复制链接">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button
            class="action-btn danger"
            @click="deleteShare(item)"
            :disabled="deletingId === item.shareId"
            title="删除"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-manage-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
  color: #1a1a1a;
}

.count {
  font-size: 13px;
  color: #999;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: #2f3640;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.create-btn:hover {
  opacity: 0.9;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #999;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #eee;
  border-top-color: #2f3640;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: #f5f5f5;
  color: #ccc;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 13px;
  color: #999;
  margin: 0 0 20px;
}

/* 分享列表 */
.share-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.share-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  transition: box-shadow 0.15s;
}

.share-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.card-cover {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f5f5f5;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.template-badge {
  font-size: 12px;
  font-weight: 600;
  color: #2f3640;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.photo-count {
  font-size: 12px;
  color: #999;
}

.card-meta {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.card-bottom {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #bbb;
}

.view-count {
  display: flex;
  align-items: center;
  gap: 3px;
}

.card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.action-btn.danger:hover {
  background: #fef2f2;
  color: #dc3545;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .share-card {
    flex-wrap: wrap;
  }

  .card-actions {
    width: 100%;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid #f5f5f5;
  }
}
</style>
