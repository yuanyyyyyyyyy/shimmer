<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { users } from '../api'
import { useAuthStore } from '../stores'

const route = useRoute()
const authStore = useAuthStore()
const user = ref(null)
const photos = ref([])
const loading = ref(false)
const page = ref(1)
const totalPages = ref(1)

// 编辑资料相关状态
const showEditModal = ref(false)
const editForm = ref({
  nickname: '',
  bio: ''
})
const saving = ref(false)

const hasMore = computed(() => page.value < totalPages.value)
const isOwnProfile = computed(() => {
  return authStore.user && authStore.user.id === parseInt(route.params.id)
})

// 打开编辑弹窗
const openEditModal = () => {
  if (user.value) {
    editForm.value = {
      nickname: user.value.nickname || '',
      bio: user.value.bio || ''
    }
    showEditModal.value = true
  }
}

// 保存资料
const saveProfile = async () => {
  saving.value = true
  try {
    const res = await users.updateProfile(editForm.value)
    user.value = { ...user.value, ...res.user }
    authStore.user = { ...authStore.user, ...res.user }
    showEditModal.value = false
  } catch (e) {
    console.error('保存失败', e)
    alert(e.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

const fetchUser = async () => {
  try {
    const res = await users.getProfile(route.params.id)
    user.value = res.user
  } catch (e) {
    console.error('获取用户信息失败', e)
  }
}

const fetchPhotos = async (reset = false) => {
  if (loading.value) return

  if (reset) {
    page.value = 1
    photos.value = []
  }

  loading.value = true
  try {
    const res = await users.getUserPhotos(route.params.id, {
      page: page.value,
      limit: 12
    })
    if (reset) {
      photos.value = res.photos
    } else {
      photos.value.push(...res.photos)
    }
    totalPages.value = res.pagination.totalPages
  } catch (e) {
    console.error('获取照片失败', e)
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  if (hasMore.value) {
    page.value++
    fetchPhotos()
  }
}

const getPhotoStyle = (photo) => {
  const aspectRatio = photo.width && photo.height
    ? photo.width / photo.height
    : 1
  return { aspectRatio: aspectRatio.toFixed(2) }
}

onMounted(async () => {
  await fetchUser()
  await fetchPhotos(true)
})
</script>

<template>
  <div class="user-profile">
    <div class="container">
      <div v-if="user" class="profile-header">
        <div class="avatar">
          <img v-if="user.avatar" :src="user.avatar" :alt="user.nickname" />
          <span v-else class="avatar-placeholder">
            {{ (user.nickname || user.username).charAt(0).toUpperCase() }}
          </span>
        </div>
        <div class="profile-info">
          <h1>{{ user.nickname || user.username }}</h1>
          <p class="username">@{{ user.username }}</p>
          <p v-if="user.bio" class="bio">{{ user.bio }}</p>
          <div class="stats">
            <div class="stat-item">
              <strong>{{ user.photoCount || 0 }}</strong>
              <span>公开照片</span>
            </div>
            <div v-if="isOwnProfile" class="stat-item">
              <strong>{{ user.totalPhotoCount || 0 }}</strong>
              <span>全部照片</span>
            </div>
            <div class="stat-item">
              <strong>{{ user.favoriteCount || 0 }}</strong>
              <span>被收藏</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div v-if="isOwnProfile" class="profile-actions">
            <button class="btn-edit" @click="openEditModal">编辑资料</button>
            <router-link to="/admin" class="btn-link">管理照片</router-link>
            <router-link to="/favorites" class="btn-link">我的收藏</router-link>
          </div>
        </div>
      </div>

      <div v-else class="loading">加载中...</div>

      <div class="divider"></div>

      <div v-if="loading && photos.length === 0" class="loading">
        加载中...
      </div>

      <div v-else-if="photos.length === 0" class="empty">
        <p>还没有公开照片</p>
      </div>

      <div v-else class="photo-grid">
        <div
          v-for="photo in photos"
          :key="photo.id"
          class="photo-card"
        >
          <router-link :to="`/photo/${photo.id}`" class="photo-link">
            <div class="photo-wrapper" :style="getPhotoStyle(photo)">
              <img
                :src="photo.thumbnail_url || photo.url"
                :alt="photo.title"
                loading="lazy"
              />
            </div>
            <div class="photo-info">
              <h3>{{ photo.title || '无标题' }}</h3>
              <p class="date">{{ photo.shot_date || '未知日期' }}</p>
            </div>
          </router-link>
        </div>
      </div>

      <div v-if="hasMore" class="load-more">
        <button @click="loadMore" :disabled="loading">
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>

      <!-- 编辑资料弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-content">
          <h2>编辑个人资料</h2>
          <form @submit.prevent="saveProfile">
            <div class="form-group">
              <label>昵称</label>
              <input
                v-model="editForm.nickname"
                type="text"
                placeholder="显示名称"
                maxlength="50"
              />
            </div>
            <div class="form-group">
              <label>个人简介</label>
              <textarea
                v-model="editForm.bio"
                placeholder="介绍一下自己吧..."
                maxlength="200"
                rows="3"
              ></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" @click="showEditModal = false">取消</button>
              <button type="submit" class="btn-save" :disabled="saving">
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-profile {
  padding: 40px 0;
}

.user-profile .container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.profile-header {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  margin-bottom: 32px;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--secondary-color);
  color: #fff;
  font-size: 3rem;
  font-weight: bold;
}

.profile-info h1 {
  font-size: 1.8rem;
  margin-bottom: 4px;
}

.username {
  color: #999;
  margin-bottom: 12px;
}

.bio {
  margin-bottom: 16px;
  line-height: 1.6;
}

.stats {
  display: flex;
  gap: 32px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-item strong {
  font-size: 1.5rem;
  color: #333;
}

.stat-item span {
  font-size: 0.85rem;
  color: #666;
}

.profile-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-edit {
  padding: 8px 20px;
  background: var(--secondary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}

.btn-edit:hover {
  opacity: 0.9;
}

.btn-link {
  padding: 8px 20px;
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-link:hover {
  background: #eee;
}

/* 编辑弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  padding: 32px;
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h2 {
  margin-bottom: 24px;
  font-size: 1.3rem;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9rem;
  color: #666;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-cancel {
  padding: 10px 20px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-save {
  padding: 10px 24px;
  background: var(--secondary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.divider {
  height: 1px;
  background: #eee;
  margin: 32px 0;
}

.loading, .empty {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.photo-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.photo-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.photo-link {
  text-decoration: none;
  color: inherit;
}

.photo-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #f5f5f5;
}

.photo-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-info {
  padding: 16px;
}

.photo-info h3 {
  font-size: 1rem;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-info .date {
  font-size: 0.85rem;
  color: #999;
}

.load-more {
  text-align: center;
  margin-top: 40px;
}

.load-more button {
  padding: 12px 32px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.load-more button:hover:not(:disabled) {
  background: #eee;
}

.load-more button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .stats {
    justify-content: center;
  }
}
</style>
