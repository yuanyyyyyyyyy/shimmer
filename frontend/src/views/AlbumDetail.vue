<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { albums, photos } from '../api'
import { useAuthStore } from '../stores'
import { success, error } from '../composables/useToast'
import Lightbox from '../components/Lightbox.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const album = ref(null)
const photoList = ref([])
const loading = ref(false)
const showAddPhotoDialog = ref(false)
const showEditDialog = ref(false)

// 编辑表单
const editForm = ref({
  title: '',
  description: '',
  is_public: true
})

// 编辑弹窗 Tab
const editActiveTab = ref('cover')

// 封面选择器
const coverPickerVisible = ref(false)
const selectedCoverId = ref(null)

// 添加照片相关
const searchQuery = ref('')
const searchResults = ref([])
const selectedPhotos = ref(new Set())
const searchLoading = ref(false)
let debounceTimer = null

// 添加照片弹窗 Tab
const addPhotoActiveTab = ref('search')
const selectedCount = computed(() => selectedPhotos.value.size)

// 照片预览
const showPreviewModal = ref(false)
const previewPhoto = ref(null)

// Lightbox
const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

// 加载相册详情
const loadAlbum = async () => {
  const albumId = route.params.id
  loading.value = true

  try {
    const data = await albums.get(albumId)
    album.value = data
    photoList.value = data.photos || []

    // 初始化编辑表单
    editForm.value = {
      title: data.title,
      description: data.description || '',
      is_public: data.is_public
    }
  } catch (err) {
    error(err.message || '加载相册失败')
    router.push('/albums')
  } finally {
    loading.value = false
  }
}

// 更新相册
const updateAlbum = async () => {
  if (!editForm.value.title.trim()) {
    error('请输入相册名称')
    return
  }
  try {
    const res = await albums.update(album.value.id, editForm.value)
    album.value = { ...album.value, ...res.album }
    success('相册更新成功')
    showEditDialog.value = false
  } catch (err) {
    error(err.message || '更新失败')
  }
}

// 删除相册
const deleteAlbum = async () => {
  if (!confirm('确定要删除这个相册吗？删除后无法恢复！')) return

  try {
    await albums.delete(album.value.id)
    success('相册已删除')
    router.push('/albums')
  } catch (err) {
    error(err.message || '删除失败')
  }
}

// 搜索照片（带防抖）
const searchPhotos = async () => {
  if (debounceTimer) clearTimeout(debounceTimer)

  if (!searchQuery.value.trim()) {
    searchResults.value = []
    searchLoading.value = false
    return
  }

  searchLoading.value = true
  debounceTimer = setTimeout(async () => {
    try {
      const res = await photos.list({
        search: searchQuery.value,
        limit: 50
      })
      searchResults.value = res.data || []
    } catch (err) {
      error('搜索失败')
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

// 切换封面选择器（Tab 模式下封面选择器始终可见，仅初始化选中状态）
const toggleCoverPicker = () => {
  if (!coverPickerVisible.value) {
    selectedCoverId.value = album.value?.cover_id || null
  }
  coverPickerVisible.value = !coverPickerVisible.value
}

// 选择封面照片
const selectCover = async (photoId) => {
  try {
    await albums.setCover(album.value.id, photoId)
    album.value.cover_id = photoId
    const photo = photoList.value.find(p => p.id === photoId)
    if (photo) {
      album.value.cover_url = photo.url
    }
    selectedCoverId.value = photoId
    success('封面已更新')
    coverPickerVisible.value = false
  } catch (err) {
    error(err.message || '设置封面失败')
  }
}

// 打开照片预览
const openPreview = (photo, event) => {
  if (event) event.stopPropagation()
  previewPhoto.value = photo
  showPreviewModal.value = true
}

// 关闭预览
const closePreview = () => {
  showPreviewModal.value = false
  previewPhoto.value = null
}

// 从预览添加到相册
const addPhotoFromPreview = async (photoId) => {
  try {
    await albums.addPhoto(album.value.id, photoId)
    success('照片已添加到相册')
    closePreview()
    loadAlbum()
  } catch (err) {
    error(err.message || '添加失败')
  }
}

// 切换选择照片
const toggleSelectPhoto = (photoId) => {
  const newSet = new Set(selectedPhotos.value)
  if (newSet.has(photoId)) {
    newSet.delete(photoId)
  } else {
    newSet.add(photoId)
  }
  selectedPhotos.value = newSet
}

// 添加选中的照片到相册
const addSelectedPhotos = async () => {
  const photoIds = Array.from(selectedPhotos.value)
  if (photoIds.length === 0) {
    error('请先选择照片')
    return
  }

  try {
    for (const photoId of photoIds) {
      await albums.addPhoto(album.value.id, photoId)
    }
    success(`已添加 ${photoIds.length} 张照片到相册`)
    showAddPhotoDialog.value = false
    selectedPhotos.value = new Set()
    searchQuery.value = ''
    searchResults.value = []
    loadAlbum() // 重新加载
  } catch (err) {
    error(err.message || '添加失败')
  }
}

// 从相册移除照片
const removePhoto = async (photoId) => {
  if (!confirm('确定要从相册中移除这张照片吗？')) return

  try {
    await albums.removePhoto(album.value.id, photoId)
    success('照片已移除')
    loadAlbum() // 重新加载
  } catch (err) {
    error(err.message || '移除失败')
  }
}

// 设置封面
const setAsCover = async (photoId) => {
  try {
    await albums.setCover(album.value.id, photoId)
    success('封面已更新')
    loadAlbum() // 重新加载
  } catch (err) {
    error(err.message || '设置失败')
  }
}

// 查看大图
const viewPhoto = (index) => {
  lightboxIndex.value = index
  lightboxVisible.value = true
}

// 检查权限
const canEdit = () => {
  return authStore.isLoggedIn &&
    album.value &&
    (authStore.user?.id === album.value.user_id || authStore.isAdmin)
}

onMounted(() => {
  loadAlbum()
})
</script>

<template>
  <div class="detail-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中</p>
    </div>

    <!-- 相册内容 -->
    <template v-else-if="album">
      <!-- 相册头部 -->
      <header class="album-hero">
        <div class="hero-cover">
          <img v-if="album.cover_url" :src="album.cover_url" :alt="album.title">
          <div v-else class="no-cover">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </div>

        <div class="hero-body">
          <h1 class="hero-title">{{ album.title }}</h1>
          <p v-if="album.description" class="hero-desc">{{ album.description }}</p>

          <ul class="meta-list">
            <li class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {{ album.nickname || album.username }}
            </li>
            <li class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {{ new Date(album.created_at).toLocaleDateString() }}
            </li>
            <li class="meta-item">
              <span class="visibility-dot" :class="album.is_public ? 'dot-public' : 'dot-private'"></span>
              {{ album.is_public ? '公开' : '私有' }}
            </li>
            <li class="meta-item meta-count">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {{ album.photo_count || photoList.length }} 张照片
            </li>
          </ul>

          <!-- 操作按钮 -->
          <nav v-if="canEdit()" class="action-bar">
            <button class="btn-outline" @click="showEditDialog = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              编辑
            </button>
            <button class="btn-primary" @click="showAddPhotoDialog = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              添加照片
            </button>
            <button class="btn-text btn-danger" @click="deleteAlbum">
              删除相册
            </button>
          </nav>
        </div>
      </header>

      <!-- 照片网格 -->
      <section v-if="photoList.length > 0" class="photos-section">
        <h2 class="section-label">照片</h2>
        <div class="photos-grid">
          <figure
            v-for="(photo, index) in photoList"
            :key="photo.id"
            class="photo-card"
            tabindex="0"
            role="button"
            :aria-label="'查看 ' + photo.title"
            @click="viewPhoto(index)"
            @keydown.enter="viewPhoto(index)"
          >
            <img
              :src="photo.thumbnail_url || photo.url"
              :alt="photo.title"
              loading="lazy"
            >
            <figcaption class="photo-overlay">
              <span class="overlay-title">{{ photo.title }}</span>
              <div v-if="canEdit()" class="overlay-actions">
                <button class="overlay-btn" title="设为封面" @click.stop="setAsCover(photo.id)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>
                <button class="overlay-btn btn-danger" title="移除" @click.stop="removePhoto(photo.id)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- 空状态 -->
      <section v-else class="empty-section">
        <div class="empty-visual">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <p class="empty-msg">相册还没有照片</p>
        <p v-if="canEdit()" class="empty-hint">点击下方按钮开始添加</p>
        <button
          v-if="canEdit()"
          class="btn-primary"
          @click="showAddPhotoDialog = true"
        >
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加照片
        </button>
      </section>

      <!-- Lightbox -->
      <Lightbox
        v-if="lightboxVisible"
        :photos="photoList"
        :initial-index="lightboxIndex"
        @close="lightboxVisible = false"
      />

      <!-- 编辑对话框 -->
      <Teleport to="body">
        <div v-if="showEditDialog" class="modal-backdrop" @click.self="showEditDialog = false">
          <div class="modal-panel">
            <header class="modal-header">
              <h2>编辑相册</h2>
              <button class="btn-icon" @click="showEditDialog = false" aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>

            <!-- Tab 栏 -->
            <div class="modal-tabs">
              <button
                type="button"
                class="modal-tab"
                :class="{ active: editActiveTab === 'cover' }"
                @click="editActiveTab = 'cover'"
              >封面</button>
              <button
                type="button"
                class="modal-tab"
                :class="{ active: editActiveTab === 'info' }"
                @click="editActiveTab = 'info'"
              >信息</button>
            </div>

            <!-- Tab 面板 -->
            <div class="tab-panel">
              <!-- 封面 Tab -->
              <div v-show="editActiveTab === 'cover'" class="tab-pane">
                <div class="cover-preview" :class="{ 'no-cover': !album?.cover_url }">
                  <img v-if="album?.cover_url" :src="album.cover_url" alt="封面预览">
                  <div v-else class="cover-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>暂无封面</span>
                  </div>
                </div>

                <div class="cover-actions">
                  <button type="button" class="btn-cover-change" @click="toggleCoverPicker">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    {{ coverPickerVisible ? '收起' : '更换封面' }}
                  </button>
                </div>

                <!-- 封面选择器 -->
                <div v-if="coverPickerVisible" class="cover-picker">
                  <div v-if="photoList.length === 0" class="cover-picker-empty">
                    相册内暂无照片
                  </div>
                  <div v-else class="cover-picker-grid">
                    <button
                      v-for="photo in photoList"
                      :key="photo.id"
                      type="button"
                      class="cover-pick-card"
                      :class="{ active: selectedCoverId === photo.id }"
                      @click="selectCover(photo.id)"
                    >
                      <img :src="photo.thumbnail_url || photo.url" :alt="photo.title" loading="lazy">
                      <span v-if="selectedCoverId === photo.id" class="cover-pick-check">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 信息 Tab -->
              <div v-show="editActiveTab === 'info'" class="tab-pane">
                <div class="field">
                  <label for="edit-title">名称</label>
                  <input id="edit-title" v-model="editForm.title" type="text" required maxlength="100" placeholder="相册名称">
                </div>
                <div class="field">
                  <label for="edit-desc">描述</label>
                  <textarea id="edit-desc" v-model="editForm.description" rows="3" placeholder="为相册添加描述（可选）"></textarea>
                </div>
                <div class="field field-checkbox">
                  <label class="toggle-label">
                    <input v-model="editForm.is_public" type="checkbox">
                    <span class="toggle-custom"></span>
                    <span>公开相册</span>
                  </label>
                </div>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-text" @click="showEditDialog = false">取消</button>
              <button type="button" class="btn-primary" @click="updateAlbum">保存更改</button>
            </footer>
          </div>
        </div>
      </Teleport>

      <!-- 添加照片对话框 -->
      <Teleport to="body">
        <div v-if="showAddPhotoDialog" class="modal-backdrop" @click.self="showAddPhotoDialog = false">
          <div class="modal-panel modal-wide">
            <header class="modal-header">
              <h2>添加照片</h2>
              <button class="btn-icon" @click="showAddPhotoDialog = false" aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>

            <!-- Tab 栏 -->
            <div class="modal-tabs">
              <button
                type="button"
                class="modal-tab"
                :class="{ active: addPhotoActiveTab === 'search' }"
                @click="addPhotoActiveTab = 'search'"
              >搜索</button>
              <button
                type="button"
                class="modal-tab"
                :class="{ active: addPhotoActiveTab === 'selected' }"
                @click="addPhotoActiveTab = 'selected'"
              >
                已选
                <span v-if="selectedCount > 0" class="tab-badge">{{ selectedCount }}</span>
              </button>
            </div>

            <!-- Tab 面板 -->
            <div class="tab-panel">
              <!-- 搜索 Tab -->
              <div v-show="addPhotoActiveTab === 'search'" class="tab-pane add-photo-search-pane">
                <div class="search-bar">
                  <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="搜索标题、心情、地点..."
                    @input="searchPhotos"
                    autocomplete="off"
                  >
                  <div v-if="searchLoading" class="search-spinner"></div>
                </div>

                <!-- 搜索结果 -->
                <div v-if="searchResults.length > 0" class="picker-grid">
                  <div
                    v-for="photo in searchResults"
                    :key="photo.id"
                    class="pick-card"
                    :class="{ picked: selectedPhotos.has(photo.id) }"
                    @click="toggleSelectPhoto(photo.id)"
                  >
                    <img :src="photo.thumbnail_url || photo.url" :alt="photo.title" loading="lazy">
                    <span v-if="selectedPhotos.has(photo.id)" class="pick-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                    <span class="pick-name">{{ photo.title }}</span>
                    <button
                      type="button"
                      class="pick-preview-btn"
                      title="预览"
                      @click.stop="openPreview(photo, $event)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- 搜索中 -->
                <div v-else-if="searchLoading" class="picker-loading">
                  <div class="picker-spinner"></div>
                  <span>搜索中...</span>
                </div>

                <!-- 空结果 / 提示 -->
                <div v-else-if="searchQuery" class="picker-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <line x1="8" y1="8" x2="14" y2="14"/>
                    <line x1="14" y1="8" x2="8" y2="14"/>
                  </svg>
                  没有找到匹配的照片
                </div>
                <div v-else class="picker-hint">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  输入关键词搜索要添加的照片
                </div>
              </div>

              <!-- 已选 Tab -->
              <div v-show="addPhotoActiveTab === 'selected'" class="tab-pane">
                <div v-if="selectedCount === 0" class="picker-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  还没有选择照片
                </div>
                <div v-else class="selected-list">
                  <div
                    v-for="photo in searchResults.filter(p => selectedPhotos.has(p.id))"
                    :key="photo.id"
                    class="selected-item"
                  >
                    <img :src="photo.thumbnail_url || photo.url" :alt="photo.title" class="selected-thumb">
                    <span class="selected-name">{{ photo.title }}</span>
                    <button
                      type="button"
                      class="selected-remove"
                      title="移除"
                      @click="toggleSelectPhoto(photo.id)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <footer class="modal-footer modal-sticky">
              <button type="button" class="btn-text" @click="showAddPhotoDialog = false">取消</button>
              <button
                class="btn-primary"
                :disabled="selectedPhotos.size === 0"
                @click="addSelectedPhotos"
              >
                添加{{ selectedPhotos.size > 0 ? ` (${selectedPhotos.size})` : '' }}
              </button>
            </footer>
          </div>
        </div>
      </Teleport>

      <!-- 照片预览弹窗 -->
      <Teleport to="body">
        <div v-if="showPreviewModal && previewPhoto" class="modal-backdrop preview-backdrop" @click.self="closePreview">
          <div class="preview-panel">
            <button class="preview-close" @click="closePreview" aria-label="关闭预览">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div class="preview-image-wrap">
              <img :src="previewPhoto.url" :alt="previewPhoto.title">
            </div>
            <div class="preview-info">
              <h3 class="preview-title">{{ previewPhoto.title }}</h3>
              <p v-if="previewPhoto.taken_at" class="preview-date">
                {{ new Date(previewPhoto.taken_at).toLocaleDateString() }}
              </p>
              <button
                v-if="canEdit()"
                class="btn-primary preview-add-btn"
                @click="addPhotoFromPreview(previewPhoto.id)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                添加到相册
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
/* ========== Design Tokens ========== */
.detail-page {
  --color-accent: var(--secondary-color, #3498db);
  --color-surface: #ffffff;
  --color-bg: oklch(98% 0.005 250);
  --color-text: var(--text-color, #18181b);
  --color-muted: var(--text-secondary, #52525b);
  --color-faint: var(--text-tertiary, #a1a1aa);
  --color-border: oklch(82% 0.012 250);
  --color-border-hover: oklch(75% 0.015 250);
  --color-danger: oklch(55% 0.18 25);
  --color-success: oklch(60% 0.14 155);
  --color-no-cover: oklch(94% 0.015 250);

  max-width: 960px;
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

/* Dark mode */
:global(.dark) .detail-page {
  --color-surface: oklch(14% 0.008 250);
  --color-bg: oklch(18% 0.008 250);
  --color-border: oklch(30% 0.01 250);
  --color-border-hover: oklch(38% 0.015 250);
  --color-no-cover: oklch(22% 0.015 250);
}

/* Dark mode - modal overrides */
:global(.dark) .modal-panel {
  background: oklch(16% 0.008 250);
  --color-surface: oklch(14% 0.008 250);
  --color-bg: oklch(18% 0.008 250);
  --color-border: oklch(30% 0.01 250);
  --color-border-hover: oklch(38% 0.015 250);
  --color-faint: #71717a;
  --color-muted: #a1a1aa;
}

:global(.dark) .modal-header h2 {
  color: #e4e4e7;
}

:global(.dark) .modal-tab {
  color: #a1a1aa;
}

:global(.dark) .modal-tab:hover {
  color: #d4d4d8;
}

:global(.dark) .modal-tab.active {
  color: var(--color-accent);
}

:global(.dark) .modal-footer {
  background: oklch(16% 0.008 250);
}

:global(.dark) .modal-footer.modal-sticky {
  background: oklch(16% 0.008 250);
}

:global(.dark) .field > label {
  color: #d4d4d8;
}

:global(.dark) .field input[type="text"],
:global(.dark) .field textarea,
:global(.dark) .search-bar input {
  color: #e4e4e7;
  background: oklch(20% 0.008 250);
}

:global(.dark) .toggle-label {
  color: #d4d4d8;
}

:global(.dark) .modal-footer .btn-text {
  color: #d4d4d8;
  opacity: 0.75;
}

:global(.dark) .modal-footer .btn-text:hover {
  background: oklch(24% 0.008 250);
}

:global(.dark) .picker-empty,
:global(.dark) .picker-hint {
  color: #71717a;
}

:global(.dark) .selected-item {
  background: oklch(20% 0.008 250);
}

:global(.dark) .selected-item:hover {
  background: oklch(25% 0.01 250);
}

:global(.dark) .selected-name {
  color: #e4e4e7;
}

:global(.dark) .selected-remove:hover {
  background: oklch(25% 0.06 25);
}

/* Dark mode - button/interaction overrides */
::global(.dark) .btn-icon:hover {
  background: oklch(24% 0.008 250);
}

::global(.dark) .btn-outline:hover {
  background: oklch(24% 0.04 230);
}

::global(.dark) .btn-text:hover {
  background: oklch(24% 0.008 250);
}

/* Dark mode - placeholders & focus */
::global(.dark) .search-bar input::placeholder,
::global(.dark) .field input[type="text"]::placeholder,
::global(.dark) .field textarea::placeholder {
  color: #71717a;
}

::global(.dark) .field input[type="text"]:focus,
::global(.dark) .field textarea:focus,
::global(.dark) .search-bar input:focus {
  box-shadow: 0 0 0 3px oklch(25% 0.06 var(--color-accent));
}

/* Dark mode - modal detail overrides (Teleport escape fix) */
::global(.dark) .search-bar input,
::global(.dark) .field input[type="text"],
::global(.dark) .field textarea {
  border-color: oklch(25% 0.01 250);
}

::global(.dark) .search-icon {
  color: #71717a;
}

::global(.dark) .pick-name {
  background: oklch(20% 0.008 250);
  color: #d4d4d8;
}

::global(.dark) .pick-card:hover {
  border-color: oklch(32% 0.015 250);
}

::global(.dark) .modal-footer.modal-sticky {
  border-top-color: oklch(25% 0.01 250);
}

::global(.dark) .modal-header .btn-icon {
  color: #a1a1aa;
}

::global(.dark) .modal-header .btn-icon:hover {
  color: #e4e4e7;
  background: oklch(24% 0.008 250);
}

/* Dark mode - cover section overrides */
:global(.dark) .btn-cover-change {
  border-color: oklch(30% 0.01 250);
  color: #a1a1aa;
}

:global(.dark) .btn-cover-change:hover {
  border-color: var(--color-accent);
  color: #d4d4d8;
  background: oklch(24% 0.04 230);
}

:global(.dark) .cover-picker {
  border-color: oklch(25% 0.01 250);
}

:global(.dark) .cover-pick-card.active {
  box-shadow: 0 0 0 2px oklch(25% 0.06 var(--color-accent));
}

/* Dark mode - preview button overrides */
::global(.dark) .pick-preview-btn {
  background: oklch(80% 0.01 250 / 0.7);
}

::global(.dark) .pick-preview-btn:hover {
  background: oklch(80% 0.01 250 / 0.9);
}

/* ========== Loading ========== */
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

/* ========== Hero Header ========== */
.album-hero {
  display: grid;
  grid-template-columns: minmax(320px, 380px) 1fr;
  gap: clamp(1.5rem, 3vw, 2.5rem);
  margin-bottom: clamp(2rem, 4vw, 3rem);
  align-items: start;
}

.hero-cover {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background: var(--color-no-cover);
}

.hero-cover img {
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
  color: oklch(50% 0.04 250);
}

.hero-body {
  padding-top: 0.25rem;
}

.hero-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--color-text);
  margin: 0 0 0.625rem;
  line-height: 1.25;
}

.hero-desc {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-muted);
  margin: 0 0 1.125rem;
  max-width: 520px;
}

/* Meta list */
.meta-list {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.25rem;
  padding: 0;
  margin: 0 0 1.5rem;
  font-size: 0.8125rem;
  color: var(--color-faint);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.meta-item svg {
  opacity: 0.6;
  flex-shrink: 0;
}

.meta-count {
  margin-left: auto;
  color: var(--color-muted);
}

.visibility-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-public {
  background: var(--color-success);
}

.dot-private {
  background: var(--color-faint);
}

/* Action bar */
.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  padding-top: 1.125rem;
  border-top: 1px solid var(--color-border);
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

.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.btn-primary .icon {
  flex-shrink: 0;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.btn-outline:hover {
  background: oklch(96% 0.04 230);
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

/* Modal 内的 btn-text 提升对比度 */
.modal-footer .btn-text {
  color: var(--color-text);
  opacity: 0.7;
}

.modal-footer .btn-text:hover {
  opacity: 1;
  background: oklch(94% 0.01 250);
}

.btn-text.btn-danger:hover {
  color: var(--color-danger);
  background: oklch(96% 0.03 25);
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

/* ========== Photos Section ========== */
.photos-section {
  margin-bottom: 2rem;
}

.section-label {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-faint);
  margin: 0 0 1rem;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: clamp(0.625rem, 1.25vw, 1rem);
}

.photo-card {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 1;
  background: var(--color-no-cover);
  transition: transform 0.25s cubic-bezier(0.33, 1, 0.68, 1),
              box-shadow 0.25s cubic-bezier(0.33, 1, 0.68, 1);
}

.photo-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.photo-card:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 10px 28px oklch(0% 0 0 / 0.1);
}

.photo-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1);
}

.photo-card:hover img {
  transform: scale(1.04);
}

.photo-overlay {
  position: absolute;
  inset: 0;
  bottom: auto;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, oklch(15% 0 0 / 0.55) 0%, transparent 60%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-card:hover .photo-overlay {
  opacity: 1;
}

.overlay-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overlay-actions {
  display: flex;
  gap: 0.375rem;
  justify-content: flex-end;
}

.overlay-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text);
  transition: all 0.15s ease;
}

.overlay-btn:hover {
  background: #fff;
  box-shadow: 0 2px 8px oklch(0% 0 0 / 0.12);
}

.overlay-btn.btn-danger {
  color: var(--color-danger);
}

.overlay-btn.btn-danger:hover {
  background: oklch(97% 0.02 25);
}

/* ========== Empty State ========== */
.empty-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4rem 1rem;
  gap: 0.5rem;
}

.empty-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: var(--color-bg);
  color: var(--color-faint);
  margin-bottom: 0.75rem;
}

.empty-msg {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text);
  margin: 0;
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--color-faint);
  margin-bottom: 1.25rem;
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
  /* Teleport 到 body 后 .detail-page 的变量无法继承，在此重新声明 */
  --color-accent: var(--secondary-color, #3498db);
  --color-surface: #ffffff;
  --color-bg: oklch(98% 0.005 250);
  --color-text: var(--text-color, #18181b);
  --color-muted: var(--text-secondary, #52525b);
  --color-faint: var(--text-tertiary, #a1a1aa);
  --color-border: oklch(82% 0.012 250);
  --color-border-hover: oklch(75% 0.015 250);
  --color-danger: oklch(55% 0.18 25);
  --color-no-cover: oklch(94% 0.015 250);

  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px oklch(0% 0 0 / 0.15);
  animation: slideUp 0.25s cubic-bezier(0.33, 1, 0.68, 1);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 2rem);
}

.modal-panel.modal-wide {
  max-width: 720px;
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
  padding: 1.25rem 1.5rem 0.75rem;
  flex-shrink: 0;
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #18181b;
  margin: 0;
}

/* ========== Modal Tabs ========== */
.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  padding: 0 1.5rem;
  flex-shrink: 0;
}

.modal-tab {
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-muted);
  border: none;
  background: none;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  display: inline-flex;
  align-items: center;
}

.modal-tab:hover {
  color: var(--color-text);
}

.modal-tab.active {
  color: var(--color-accent);
}

.modal-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2.5px;
  background: var(--color-accent);
  border-radius: 1px;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--color-accent);
  color: #fff;
  border-radius: 9px;
}

/* Tab Panel */
.tab-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.tab-pane {
  padding: 1rem 1.5rem;
}

/* ========== Cover Section (Edit Modal) ========== */
.cover-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-no-cover);
  margin-bottom: 0.75rem;
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-preview.no-cover {
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-faint);
  font-size: 0.8125rem;
}

.cover-placeholder svg {
  opacity: 0.5;
}

.cover-actions {
  margin-bottom: 0.75rem;
}

.btn-cover-change {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: transparent;
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-muted);
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
  margin-bottom: 0.75rem;
}

.btn-cover-change:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: oklch(96% 0.04 230);
}

/* Cover picker */
.cover-picker {
  margin-bottom: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  animation: slideUp 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.cover-picker-empty {
  padding: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-faint);
}

.cover-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
  padding: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.cover-pick-card {
  position: relative;
  display: block;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  background: transparent;
  transition: border-color 0.15s ease, transform 0.15s ease;
  aspect-ratio: 1;
}

.cover-pick-card:hover {
  transform: scale(1.05);
}

.cover-pick-card.active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px oklch(90% 0.06 var(--color-accent));
}

.cover-pick-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-pick-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: #fff;
  border-radius: 50%;
  animation: scaleIn 0.15s cubic-bezier(0.33, 1, 0.68, 1);
}

@keyframes scaleIn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
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
  font-weight: 600;
  color: #27272a;
  margin-bottom: 0.5rem;
}

.field input[type="text"],
.field textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  color: #18181b;
  background: #ffffff;
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
  padding: 0.5rem 0;
}

.toggle-label {
  display: inline-flex !important;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #27272a;
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

/* Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  background: #ffffff;
}

.modal-footer.modal-sticky {
  margin-top: auto;
  border-top: 1px solid var(--color-border);
  padding: 1rem 1.5rem;
  background: #ffffff;
}

/* ========== Search Bar (Add Photo Modal) ========== */
.search-bar {
  position: relative;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-faint);
  pointer-events: none;
}

.search-bar input {
  width: 100%;
  padding: 0.625rem 0.875rem 0.625rem 2.375rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  color: #18181b;
  background: #ffffff;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.15s ease;
}

.search-bar input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px oklch(90% 0.06 var(--color-accent));
}

.search-bar input::placeholder {
  color: var(--color-faint);
}

/* Picker grid */
.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.pick-card {
  position: relative;
  display: block;
  border: 2px solid transparent;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  background: transparent;
  transition: border-color 0.2s ease, transform 0.15s ease;
}

.pick-card:hover {
  transform: scale(1.03);
}

.pick-card.picked {
  border-color: var(--color-accent);
}

.pick-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.pick-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: #fff;
  border-radius: 50%;
}

.pick-name {
  display: block;
  padding: 0.35rem 0.5rem;
  font-size: 0.7rem;
  color: var(--color-muted);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--color-surface);
}

/* Pick preview button */
.pick-preview-btn {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(15% 0 0 / 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
}

.pick-card:hover .pick-preview-btn {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}

.pick-preview-btn:hover {
  background: oklch(15% 0 0 / 0.9);
  transform: translateX(-50%) scale(1.1);
}

/* Search loading spinner */
.search-spinner {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

/* Picker loading state */
.picker-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 0.75rem;
  color: var(--color-faint);
  font-size: 0.875rem;
  flex: 1;
}

.picker-spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

.picker-empty,
.picker-hint {
  text-align: center;
  padding: 3rem 1rem;
  font-size: 0.875rem;
  color: var(--color-faint);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.picker-empty svg,
.picker-hint svg {
  opacity: 0.4;
}

/* ========== Selected List (Add Photo Modal) ========== */
.add-photo-search-pane {
  display: flex;
  flex-direction: column;
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--color-bg);
  transition: background 0.15s ease;
}

.selected-item:hover {
  background: var(--color-border);
}

.selected-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.selected-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-faint);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.selected-remove:hover {
  background: oklch(90% 0.02 25);
  color: var(--color-danger);
}

/* ========== Photo Preview Modal ========== */
.preview-backdrop {
  z-index: 10000;
}

.preview-panel {
  position: relative;
  width: 90vw;
  max-width: 800px;
  max-height: 90vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 80px oklch(0% 0 0 / 0.25);
  overflow: hidden;
  animation: slideUp 0.25s cubic-bezier(0.33, 1, 0.68, 1);
  display: flex;
  flex-direction: column;
}

.preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: oklch(15% 0 0 / 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  transition: all 0.15s ease;
}

.preview-close:hover {
  background: oklch(15% 0 0 / 0.85);
  transform: scale(1.08);
}

.preview-image-wrap {
  width: 100%;
  max-height: 65vh;
  overflow: hidden;
  background: oklch(96% 0.005 250);
}

.preview-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.preview-info {
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.preview-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-date {
  font-size: 0.8125rem;
  color: var(--color-faint);
  margin: 0;
  white-space: nowrap;
}

.preview-add-btn {
  flex-shrink: 0;
}

/* Dark mode - preview overrides */
:global(.dark) .preview-panel {
  background: oklch(16% 0.008 250);
}

:global(.dark) .preview-image-wrap {
  background: oklch(12% 0.008 250);
}

:global(.dark) .preview-title {
  color: #e4e4e7;
}

/* ========== Responsive ========== */
@media (max-width: 800px) {
  .album-hero {
    grid-template-columns: 1fr;
  }

  .meta-count {
    margin-left: 0;
  }

  .photos-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .modal-panel.modal-wide {
    max-width: 100%;
  }

  .modal-tab {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
  }

  .picker-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    max-height: 300px;
  }

  .cover-picker-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    max-height: 150px;
  }

  .preview-panel {
    width: 95vw;
    max-height: 85vh;
  }

  .preview-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .preview-add-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
