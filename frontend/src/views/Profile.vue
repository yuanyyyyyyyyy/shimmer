<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'
import { photos as photosApi, stats as statsApi } from '../api'

const router = useRouter()
const authStore = useAuthStore()

const userStats = ref(null)
const recentPhotos = ref([])
const loading = ref(true)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
}

const formatStorage = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

const avatarLetter = computed(() => {
  const name = authStore.user?.nickname || authStore.user?.username || 'U'
  return name.charAt(0).toUpperCase()
})

onMounted(async () => {
  try {
    const [statsRes, photosRes] = await Promise.all([
      statsApi.get(),
      photosApi.getMyList({ page: 1, limit: 9 })
    ])
    userStats.value = statsRes
    recentPhotos.value = photosRes.photos || []
  } catch (e) {
    console.error('加载个人中心失败:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="profile-page">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else>
      <!-- 个人信息卡片 -->
      <div class="profile-card">
        <div class="profile-avatar">{{ avatarLetter }}</div>
        <div class="profile-info">
          <h2 class="profile-name">{{ authStore.user?.nickname || authStore.user?.username }}</h2>
          <span class="profile-username">@{{ authStore.user?.username }}</span>
          <span class="profile-date">{{ formatDate(authStore.user?.created_at) }} 加入</span>
        </div>
        <router-link to="/settings" class="profile-edit-btn">编辑资料</router-link>
      </div>

      <!-- 统计卡片 -->
      <div class="profile-stats" v-if="userStats">
        <div class="stat-item">
          <span class="stat-num">{{ userStats.photos }}</span>
          <span class="stat-lbl">照片</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ userStats.albums }}</span>
          <span class="stat-lbl">相册</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ userStats.days }}</span>
          <span class="stat-lbl">活跃天数</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ userStats.stories }}</span>
          <span class="stat-lbl">故事</span>
        </div>
      </div>

      <!-- 最近照片 -->
      <div class="profile-section">
        <div class="section-header">
          <h3>最近照片</h3>
          <router-link to="/timeline" class="section-link">查看全部</router-link>
        </div>
        <div v-if="recentPhotos.length === 0" class="empty-state">
          <p>还没有照片</p>
          <router-link to="/admin" class="empty-action">去上传</router-link>
        </div>
        <div v-else class="photo-grid">
          <router-link
            v-for="photo in recentPhotos"
            :key="photo.id"
            :to="`/photo/${photo.id}`"
            class="photo-grid-item"
          >
            <img :src="photo.thumbnail_url || photo.url" :alt="photo.title" loading="lazy" />
          </router-link>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="profile-actions">
        <router-link to="/admin" class="action-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>上传照片</span>
        </router-link>
        <router-link to="/albums" class="action-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>管理相册</span>
        </router-link>
        <router-link to="/settings" class="action-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>设置</span>
        </router-link>
      </div>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

.loading {
  text-align: center;
  padding: 60px 0;
  color: var(--text-tertiary, #999);
}

/* 个人信息卡片 */
.profile-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 12px;
  margin-bottom: 24px;
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #2f3640;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 4px;
}

.profile-username {
  display: block;
  font-size: 0.88rem;
  color: var(--text-secondary, #888);
  margin-bottom: 4px;
}

.profile-date {
  font-size: 0.78rem;
  color: var(--text-tertiary, #aaa);
}

.profile-edit-btn {
  padding: 8px 16px;
  font-size: 0.82rem;
  color: var(--text-secondary, #666);
  border: 1px solid var(--n-300);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}

.profile-edit-btn:hover {
  color: var(--text-color);
  border-color: var(--text-secondary);
}

/* 统计卡片 */
.profile-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.stat-item {
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 10px;
  padding: 16px 12px;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1.2;
}

.stat-lbl {
  font-size: 0.78rem;
  color: var(--text-tertiary, #999);
  margin-top: 4px;
}

/* 分区 */
.profile-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.section-link {
  font-size: 0.82rem;
  color: var(--text-secondary, #888);
  text-decoration: none;
}

.section-link:hover {
  color: var(--text-color);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 10px;
  color: var(--text-tertiary, #999);
}

.empty-state p {
  margin: 0 0 12px;
}

.empty-action {
  font-size: 0.85rem;
  color: var(--text-color);
  text-decoration: underline;
}

/* 照片九宫格 */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  border-radius: 10px;
  overflow: hidden;
}

.photo-grid-item {
  aspect-ratio: 1;
  overflow: hidden;
  display: block;
}

.photo-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.photo-grid-item:hover img {
  transform: scale(1.05);
}

/* 快捷操作 */
.profile-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
}

.action-card:hover {
  color: var(--text-color);
  border-color: var(--text-secondary);
}

.action-card span {
  font-size: 0.85rem;
}

@media (max-width: 500px) {
  .profile-card {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  .profile-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .photo-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
