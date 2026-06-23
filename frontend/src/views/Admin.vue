<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'
import { photos, upload, tags, ai, users, stats as statsApi, share } from '../api'
import { success, error, confirm } from '../composables/useToast'
import DragDropUpload from '../components/DragDropUpload.vue'
import { extractExif } from '../composables/useExif'

const router = useRouter()
const authStore = useAuthStore()

// 照片列表
const photoList = ref([])
const loading = ref(true)
const page = ref(1)
const total = ref(0)

// 上传状态
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadedPhotos = ref([])

// 标签列表
const allTags = ref([])
const selectedTags = ref([])

// 标签页
const activeTab = ref('photos')

// 用户管理
const userList = ref([])
const usersLoading = ref(false)
const usersPage = ref(1)
const usersTotal = ref(0)

// 统计数据
const statsOverview = ref(null)
const statsTimeline = ref([])
const statsHeatmap = ref([])
const statsLoading = ref(false)

// 分享管理
const shareList = ref([])
const sharesLoading = ref(false)
const shareDeletingId = ref(null)

// 表单
const showForm = ref(false)
const uploadMode = ref('single') // 'single' | 'batch'
const editingPhoto = ref(null)
const aiLoading = ref(false)
const aiTags = ref([])
const form = ref({
  title: '',
  mood: '',
  shot_date: '',
  location: '',
  camera: '',
  lens: '',
  aperture: '',
  shutter_speed: '',
  iso: null,
  url: '',
  thumbnail_url: '',
  width: 0,
  height: 0,
  file_size: 0,
  visibility: 'private',
  latitude: null,
  longitude: null
})

// 检查登录
onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }
  await authStore.fetchUser()
  loadPhotos()
  loadTags()
})

// 加载标签
const loadTags = async () => {
  try {
    const res = await tags.list()
    allTags.value = res.tags
  } catch (e) {
    console.error(e)
  }
}

// 创建新标签
const createTag = async () => {
  const name = prompt('请输入标签名称:')
  if (!name) return
  
  try {
    const res = await tags.create({ name })
    allTags.value.push(res.tag)
    success('标签创建成功')
  } catch (e) {
    error(e.response?.data?.error || '创建失败')
  }
}

// AI 自动补全标题、心情和标签建议（需要先在设置页面启用 AI）
const generateAiMetadata = async () => {
  if (!form.value.url) {
    error('请先上传图片后再生成 AI 建议')
    return
  }

  aiLoading.value = true
  aiTags.value = []

  try {
    const res = await ai.generateMetadata({
      url: form.value.url,
      location: form.value.location,
      shot_date: form.value.shot_date
    })

    const metadata = res.metadata || {}
    const hasContent = metadata.title || metadata.mood || (metadata.tags && metadata.tags.length > 0)
    if (metadata.title) {
      form.value.title = metadata.title
    }
    if (metadata.mood) {
      form.value.mood = metadata.mood
    }
    aiTags.value = Array.isArray(metadata.tags) ? metadata.tags : []
    if (hasContent) {
      success('AI 建议已生成，可自行调整后保存')
    } else {
      error('AI 未能识别照片内容，请手动填写')
    }
  } catch (err) {
    error(err.response?.data?.error || 'AI 自动补全失败，请确认已在 AI 设置中配置并启用')
  } finally {
    aiLoading.value = false
  }
}

// 点击 AI 建议标签：自动创建并选中
const addAiTag = async (tagName) => {
  try {
    // 1. 查找是否已存在同名标签
    let existingTag = allTags.value.find(t => t.name === tagName)

    // 2. 如果不存在，先创建新标签
    if (!existingTag) {
      const res = await tags.create({ name: tagName })
      existingTag = res.tag
      allTags.value.push(existingTag)
    }

    // 3. 选中该标签
    if (!selectedTags.value.includes(existingTag.id)) {
      selectedTags.value.push(existingTag.id)
    }

    success(`已添加标签「${tagName}」`)
  } catch (err) {
    error(err.response?.data?.error || '添加标签失败')
  }
}

// 检查 AI 标签是否已被选中
const isAiTagSelected = (tagName) => {
  const tag = allTags.value.find(t => t.name === tagName)
  return tag && selectedTags.value.includes(tag?.id)
}

// 切换标签
const toggleTag = (tagId) => {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

const deleteTag = async (tag) => {
  if (!await confirm(`确定删除标签「${tag.name}」？`)) return
  try {
    await tags.delete(tag.id)
    allTags.value = allTags.value.filter(t => t.id !== tag.id)
    selectedTags.value = selectedTags.value.filter(id => id !== tag.id)
    success(`已删除标签「${tag.name}」`)
  } catch (e) {
    error('删除标签失败')
  }
}

// 处理拖拽上传完成
const handleBatchUploaded = (photoData) => {
  uploadedPhotos.value.push(photoData)
}

// 处理拖拽上传中
const handleBatchUploading = (isUploading) => {
  uploading.value = isUploading
}

// 加载照片
const loadPhotos = async () => {
  loading.value = true
  try {
    const res = await photos.getMyPhotos({ page: page.value, limit: 20, sort: 'created' })
    photoList.value = res.data
    total.value = res.total
  } catch (e) {
    console.error('加载照片失败:', e)
    error(e.response?.data?.error || '加载照片失败')
  } finally {
    loading.value = false
  }
}

// 文件选择
const handleFileSelect = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  uploading.value = true
  uploadProgress.value = 0

  try {
    // 并行执行：上传文件和读取 EXIF
    const [res, exifData] = await Promise.all([
      upload.single(file),
      extractExif(file)
    ])
    
    form.value.url = res.url
    form.value.thumbnail_url = res.thumbnail_url
    form.value.width = res.width
    form.value.height = res.height
    form.value.file_size = res.file_size

    // 自动填充相机 EXIF 数据
    if (res.camera) form.value.camera = res.camera
    if (res.lens) form.value.lens = res.lens
    if (res.aperture) form.value.aperture = res.aperture
    if (res.shutter_speed) form.value.shutter_speed = res.shutter_speed
    if (res.iso) form.value.iso = res.iso
    
    // 自动填充客户端 EXIF 数据
    if (exifData.shot_date && !form.value.shot_date) {
      form.value.shot_date = exifData.shot_date.split('T')[0]
    }
    if (exifData.latitude && exifData.longitude) {
      form.value.latitude = exifData.latitude
      form.value.longitude = exifData.longitude
    }
  } catch (err) {
    error(err.response?.data?.error || '上传失败')
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!form.value.url) {
    error('请先上传图片')
    return
  }

  // 将空字符串转换为 null
  const data = {}
  for (const key in form.value) {
    data[key] = form.value[key] === '' ? null : form.value[key]
  }

  try {
    let photoId
    const payload = { ...data }
    if (aiTags.value.length > 0) {
      payload.ai_tags = aiTags.value
    }

    if (editingPhoto.value) {
      await photos.update(editingPhoto.value.id, payload)
      photoId = editingPhoto.value.id
      success('更新成功')
    } else {
      const res = await photos.create(payload)
      photoId = res.photo.id
      success('创建成功')
    }
    
    // 保存标签
    if (photoId) {
      await tags.setPhotoTags(photoId, selectedTags.value)
    }
    
    showForm.value = false
    resetForm()
    loadPhotos()
  } catch (err) {
    error(err.response?.data?.error || '操作失败')
  }
}

// 删除
const handleDelete = async (photo) => {
  if (!(await confirm('确定要删除这张照片吗？'))) return

  try {
    await photos.delete(photo.id)
    loadPhotos()
  } catch (err) {
    error(err.response?.data?.error || '删除失败')
  }
}

// 切换可见性
const toggleVisibility = async (photo) => {
  try {
    const options = ['public', 'private']
    const currentIndex = options.indexOf(photo.visibility)
    const nextIndex = (currentIndex + 1) % options.length
    const newVisibility = options[nextIndex]
    await photos.update(photo.id, { visibility: newVisibility })
    photo.visibility = newVisibility
    success(`已设置为 ${getVisibilityLabel(newVisibility)}`)
  } catch (err) {
    error(err.response?.data?.error || '操作失败')
  }
}

const getVisibilityLabel = (visibility) => {
  const labels = { public: '普通照片', private: '隐藏相册' }
  return labels[visibility] || visibility
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// 编辑
const handleEdit = async (photo) => {
  editingPhoto.value = photo
  aiTags.value = []
  aiLoading.value = false

  // 格式化日期字段，将 ISO 格式转换为 yyyy-MM-dd
  const formattedPhoto = { ...photo }
  if (formattedPhoto.shot_date) {
    formattedPhoto.shot_date = formattedPhoto.shot_date.split('T')[0]
  }

  form.value = formattedPhoto
  
  // 加载照片的标签
  try {
    const res = await tags.getPhotoTags(photo.id)
    selectedTags.value = res.tags.map(t => t.id)
  } catch (e) {
    selectedTags.value = []
  }
  
  showForm.value = true
}

// 重置表单
const resetForm = () => {
  editingPhoto.value = null
  selectedTags.value = []
  uploadedPhotos.value = []
  aiTags.value = []
  aiLoading.value = false
  form.value = {
    title: '',
    mood: '',
    shot_date: '',
    location: '',
    camera: '',
    lens: '',
    aperture: '',
    shutter_speed: '',
    iso: null,
    url: '',
    thumbnail_url: '',
    width: 0,
    height: 0,
    file_size: 0,
    visibility: 'private',
    latitude: null,
    longitude: null
  }
}

// 批量保存
const handleBatchSave = async () => {
  if (uploadedPhotos.value.length === 0) {
    error('请先上传照片')
    return
  }
  
  uploading.value = true
  
  try {
    // 为每张照片创建记录
    for (const photo of uploadedPhotos.value) {
      const data = {
        title: form.value.title || null,
        mood: form.value.mood || null,
        shot_date: form.value.shot_date || null,
        location: form.value.location || null,
        camera: photo.camera || null,
        lens: photo.lens || null,
        aperture: photo.aperture || null,
        shutter_speed: photo.shutter_speed || null,
        iso: photo.iso || null,
        url: photo.url,
        thumbnail_url: photo.thumbnail_url,
        width: photo.width,
        height: photo.height,
        file_size: photo.file_size,
        visibility: form.value.visibility
      }
      
      const res = await photos.create({
        ...data,
        ai_tags: aiTags.value
      })
      
      // 保存标签
      if (selectedTags.value.length > 0) {
        await tags.setPhotoTags(res.photo.id, selectedTags.value)
      }
    }
    
    success(`成功创建 ${uploadedPhotos.value.length} 张照片`)
    showForm.value = false
    resetForm()
    loadPhotos()
  } catch (err) {
    error(err.response?.data?.error || '操作失败')
  } finally {
    uploading.value = false
  }
}

// 分享管理
const loadShares = async () => {
  sharesLoading.value = true
  try {
    const res = await share.list({ limit: 50 })
    shareList.value = res.shares || []
  } catch (e) { console.error(e) }
  finally { sharesLoading.value = false }
}

const deleteShare = async (item) => {
  if (!await confirm('确定要删除这个分享卡片吗？')) return
  shareDeletingId.value = item.shareId
  try {
    await share.delete(item.shareId)
    shareList.value = shareList.value.filter(s => s.shareId !== item.shareId)
    success('已删除')
  } catch (e) {
    error('删除失败: ' + (e.response?.data?.error || e.message))
  } finally {
    shareDeletingId.value = null
  }
}

// 统计数据加载
const loadStats = async () => {
  statsLoading.value = true
  try {
    const [overviewRes, timelineRes, heatmapRes] = await Promise.all([
      statsApi.getOverview(),
      statsApi.getTimeline(),
      statsApi.getHeatmap()
    ])
    statsOverview.value = overviewRes
    statsTimeline.value = timelineRes.data || []
    statsHeatmap.value = heatmapRes.data || []
  } catch (e) {
    console.error('加载统计失败:', e)
  } finally {
    statsLoading.value = false
  }
}

// 折线图：计算 SVG 路径
const timelinePath = computed(() => {
  const data = statsTimeline.value
  if (!data.length) return ''
  const w = 600, h = 200, pad = 30
  const max = Math.max(...data.map(d => d.count), 1)
  const step = (w - pad * 2) / Math.max(data.length - 1, 1)
  const points = data.map((d, i) => {
    const x = pad + i * step
    const y = h - pad - (d.count / max) * (h - pad * 2)
    return `${x},${y}`
  })
  return points.join(' ')
})

const timelineLabels = computed(() => {
  const data = statsTimeline.value
  if (!data.length) return []
  const w = 600, pad = 30
  const step = (w - pad * 2) / Math.max(data.length - 1, 1)
  return data.map((d, i) => ({
    x: pad + i * step,
    label: d.month.slice(5) // 只显示月份
  }))
})

const timelineMax = computed(() => {
  return Math.max(...statsTimeline.value.map(d => d.count), 1)
})

// 热力图颜色
const heatmapMax = computed(() => {
  let max = 0
  for (const row of statsHeatmap.value) {
    for (const v of row) {
      if (v > max) max = v
    }
  }
  return max || 1
})

const heatColor = (value) => {
  if (!value) return 'transparent'
  const ratio = value / heatmapMax.value
  if (ratio < 0.25) return 'rgba(47,54,64,0.15)'
  if (ratio < 0.5) return 'rgba(47,54,64,0.35)'
  if (ratio < 0.75) return 'rgba(47,54,64,0.6)'
  return 'rgba(47,54,64,0.85)'
}

const dayLabels = ['一', '二', '三', '四', '五', '六', '日']

// 用户管理
const loadUsers = async (reset = false) => {
  if (usersLoading.value) return
  if (reset) {
    usersPage.value = 1
    userList.value = []
  }
  usersLoading.value = true
  try {
    const res = await users.list({ page: usersPage.value, limit: 20 })
    if (reset) {
      userList.value = res.users
    } else {
      userList.value.push(...res.users)
    }
    usersTotal.value = res.pagination.total
  } catch (e) {
    console.error('加载用户列表失败', e)
  } finally {
    usersLoading.value = false
  }
}

const loadMoreUsers = () => {
  usersPage.value++
  loadUsers()
}

const toggleUserRole = async (user) => {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  const action = newRole === 'admin' ? '设为管理员' : '取消管理员'
  if (!await confirm(`确定要将 ${user.username} ${action}吗？`)) return

  try {
    await users.updateRole(user.id, newRole)
    user.role = newRole
    success(`${user.username} 已${action}`)
  } catch (e) {
    error(e.response?.data?.error || '操作失败')
  }
}

// 编辑用户昵称
const editingUserId = ref(null)
const editingNickname = ref('')

const startEditUser = (user) => {
  editingUserId.value = user.id
  editingNickname.value = user.nickname || ''
}

const saveEditUser = async (user) => {
  if (!editingNickname.value || editingNickname.value.length < 2) {
    error('昵称至少2个字符')
    return
  }
  try {
    await users.adminUpdateProfile(user.id, { nickname: editingNickname.value })
    user.nickname = editingNickname.value
    editingUserId.value = null
    success('昵称已更新')
  } catch (e) {
    error(e.response?.data?.error || '操作失败')
  }
}

const cancelEditUser = () => {
  editingUserId.value = null
}

// 重置密码
const resetPwdUserId = ref(null)
const resetPwdValue = ref('')

const startResetPwd = (user) => {
  resetPwdUserId.value = user.id
  resetPwdValue.value = ''
}

const saveResetPwd = async (user) => {
  if (!resetPwdValue.value || resetPwdValue.value.length < 6) {
    error('密码至少6位')
    return
  }
  try {
    await users.resetPassword(user.id, resetPwdValue.value)
    resetPwdUserId.value = null
    success(`已重置 ${user.username} 的密码`)
  } catch (e) {
    error(e.response?.data?.error || '操作失败')
  }
}

const cancelResetPwd = () => {
  resetPwdUserId.value = null
}

// 删除用户
const deleteUser = async (user) => {
  if (!await confirm(`确定要删除用户 ${user.username} 吗？此操作不可恢复。`)) return
  try {
    await users.delete(user.id)
    userList.value = userList.value.filter(u => u.id !== user.id)
    usersTotal.value--
    success(`${user.username} 已删除`)
  } catch (e) {
    error(e.response?.data?.error || '操作失败')
  }
}

// 登出
const handleLogout = () => {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="admin-page">
    <div class="container">
      <div class="page-header">
        <div class="page-title-row">
          <h1 class="page-title">{{ authStore.isAdmin ? '管理后台' : '我的照片' }}</h1>
          <span class="page-subtitle">{{ photoList.length }} 张照片 · {{ photoList.length > 0 ? new Date(Math.max(...photoList.map(p => p.shot_date ? new Date(p.shot_date).getTime() : 0))).getFullYear() : '-' }} 年记录</span>
        </div>
        <div class="page-actions">
          <button class="action-pill" @click="showForm = true; resetForm()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>上传照片</span>
          </button>
          <router-link to="/settings" class="action-pill" title="AI 设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </router-link>
          <button class="action-pill" @click="handleLogout" title="登出">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="admin-tabs">
        <button :class="['tab-btn', { active: activeTab === 'photos' }]" @click="activeTab = 'photos'">照片管理</button>
        <button :class="['tab-btn', { active: activeTab === 'users' }]" @click="activeTab = 'users'; loadUsers(true)">用户管理</button>
        <button :class="['tab-btn', { active: activeTab === 'shares' }]" @click="activeTab = 'shares'; loadShares()">分享管理</button>
        <button v-if="authStore.isAdmin" :class="['tab-btn', { active: activeTab === 'stats' }]" @click="activeTab = 'stats'; loadStats()">统计</button>
      </div>

      <!-- 照片管理 -->
      <div v-if="activeTab === 'photos'">
      <!-- 照片列表 -->
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="photo-list">
        <div v-for="photo in photoList" :key="photo.id" class="photo-item">
          <img :src="photo.thumbnail_url || photo.url" class="photo-thumb" />
          <div class="photo-info">
            <h4>{{ photo.title || '无题' }}</h4>
            <p v-if="photo.mood" class="photo-mood">{{ photo.mood }}</p>
            <span class="photo-meta">{{ formatDate(photo.shot_date) }} · {{ photo.location || '无地点' }}</span>
          </div>
          <div class="photo-actions">
            <button class="action-btn visibility-toggle" :class="photo.visibility" @click="toggleVisibility(photo)" :title="getVisibilityLabel(photo.visibility)">
              <svg v-if="photo.visibility === 'public'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <button class="action-btn" @click="handleEdit(photo)" title="编辑">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="action-btn action-btn-danger" @click="handleDelete(photo)" title="删除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div v-if="photoList.length === 0" class="empty">暂无照片，点击上方按钮上传</div>
      </div>
      </div>

      <!-- 用户管理 -->
      <div v-if="activeTab === 'users'">
        <div v-if="usersLoading && userList.length === 0" class="loading">加载中...</div>
        <div v-else-if="userList.length === 0" class="empty">暂无用户</div>
        <div v-else class="user-list">
          <div v-for="u in userList" :key="u.id" class="user-item">
            <div class="user-item-top">
              <div class="user-avatar">{{ (u.nickname || u.username).charAt(0).toUpperCase() }}</div>
              <div class="user-info">
                <div class="user-info-names">
                  <template v-if="editingUserId === u.id">
                    <input class="inline-edit" v-model="editingNickname" @keyup.enter="saveEditUser(u)" @keyup.escape="cancelEditUser" autofocus />
                    <button class="btn-inline save" @click="saveEditUser(u)">保存</button>
                    <button class="btn-inline" @click="cancelEditUser">取消</button>
                  </template>
                  <template v-else>
                    <span class="user-name">{{ u.nickname || u.username }}</span>
                    <span class="user-username">@{{ u.username }}</span>
                  </template>
                </div>
                <span class="user-registered">{{ u.created_at ? formatDate(u.created_at) : '-' }} 注册</span>
                <div class="user-stats-row">
                  <span class="user-stat">{{ u.photo_count || 0 }} 张照片</span>
                  <span class="user-stat-dot"></span>
                  <span class="user-stat">{{ u.album_count || 0 }} 本相册</span>
                </div>
              </div>
              <span class="role-badge" :class="u.role">{{ u.role === 'admin' ? '管理员' : '用户' }}</span>
            </div>
            <!-- 重置密码输入框 -->
            <div v-if="resetPwdUserId === u.id" class="reset-pwd-row">
              <input class="inline-edit" v-model="resetPwdValue" type="password" placeholder="新密码（至少6位）" @keyup.enter="saveResetPwd(u)" @keyup.escape="cancelResetPwd" autofocus />
              <button class="btn-inline save" @click="saveResetPwd(u)">确认</button>
              <button class="btn-inline" @click="cancelResetPwd">取消</button>
            </div>
            <div class="user-item-divider"></div>
            <div class="user-item-actions">
              <button v-if="u.id !== authStore.userId" class="action-btn" @click="toggleUserRole(u)">
                {{ u.role === 'admin' ? '取消管理员' : '设为管理员' }}
              </button>
              <button v-if="u.id !== authStore.userId" class="action-btn" @click="startEditUser(u)">编辑昵称</button>
              <button v-if="u.id !== authStore.userId" class="action-btn" @click="startResetPwd(u)">重置密码</button>
              <button v-if="u.id !== authStore.userId" class="action-btn danger" @click="deleteUser(u)">删除用户</button>
              <span v-if="u.id === authStore.userId" class="self-tag">当前用户</span>
            </div>
          </div>
        </div>
        <div v-if="userList.length < usersTotal" class="load-more">
          <button @click="loadMoreUsers" :disabled="usersLoading" class="btn-text">
            {{ usersLoading ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>

      <!-- 分享管理 -->
      <div v-if="activeTab === 'shares'">
        <div v-if="sharesLoading" class="loading">加载中...</div>
        <div v-else-if="shareList.length === 0" class="empty">暂无分享卡片</div>
        <div v-else class="share-list">
          <div v-for="item in shareList" :key="item.shareId" class="share-item">
            <div class="share-cover">
              <img v-if="item.coverPhoto" :src="item.coverPhoto.thumbnail_url || item.coverPhoto.url" alt="" />
              <div v-else class="no-cover">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
            </div>
            <div class="share-info">
              <div class="share-meta-top">
                <span class="tpl-badge">{{ item.template }}</span>
                <span class="share-count">{{ item.photoCount }} 张</span>
              </div>
              <div class="share-meta-mid" v-if="item.storyDate || item.storyLocation">
                <span v-if="item.storyDate">{{ item.storyDate }}</span>
                <span v-if="item.storyLocation">· {{ item.storyLocation }}</span>
              </div>
              <div class="share-meta-bottom">
                <span class="share-views">{{ item.viewCount }} 次浏览</span>
              </div>
            </div>
            <div class="share-actions">
              <a :href="`/share/${item.shareId}`" target="_blank" class="btn-sm">查看</a>
              <button class="btn-sm danger" @click="deleteShare(item)" :disabled="shareDeletingId === item.shareId">删除</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计 -->
      <div v-if="activeTab === 'stats'" class="stats-dashboard">
        <div v-if="statsLoading" class="loading">加载中...</div>
        <template v-else>
          <!-- 概览卡片 -->
          <div class="stats-overview" v-if="statsOverview">
            <div class="stat-card">
              <span class="stat-num">{{ statsOverview.users }}</span>
              <span class="stat-lbl">用户</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ statsOverview.photos }}</span>
              <span class="stat-lbl">照片</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ statsOverview.albums }}</span>
              <span class="stat-lbl">相册</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ statsOverview.publicPhotos }}</span>
              <span class="stat-lbl">公开照片</span>
            </div>
          </div>

          <!-- 折线图 -->
          <div class="chart-section" v-if="statsTimeline.length">
            <h3 class="chart-title">月度照片趋势</h3>
            <div class="chart-wrap">
              <svg viewBox="0 0 600 200" class="timeline-svg">
                <!-- 网格线 -->
                <line v-for="i in 4" :key="'g'+i" x1="30" :y1="30 + (i-1) * 35" x2="570" :y2="30 + (i-1) * 35" stroke="#f0f0f0" stroke-width="1"/>
                <!-- 折线 -->
                <polyline :points="timelinePath" fill="none" stroke="#2f3640" stroke-width="2" stroke-linejoin="round"/>
                <!-- 数据点 -->
                <circle v-for="(pt, i) in timelinePath.split(' ')" :key="'p'+i" :cx="pt.split(',')[0]" :cy="pt.split(',')[1]" r="3" fill="#2f3640"/>
                <!-- X 轴标签 -->
                <text v-for="(l, i) in timelineLabels" :key="'l'+i" :x="l.x" y="195" text-anchor="middle" fill="#999" font-size="10">{{ l.label }}</text>
                <!-- Y 轴标签 -->
                <text x="25" y="35" text-anchor="end" fill="#bbb" font-size="9">{{ timelineMax }}</text>
                <text x="25" y="170" text-anchor="end" fill="#bbb" font-size="9">0</text>
              </svg>
            </div>
          </div>

          <!-- 热力图 -->
          <div class="chart-section" v-if="statsHeatmap.length">
            <h3 class="chart-title">拍摄热力图</h3>
            <div class="heatmap-wrap">
              <div class="heatmap-grid">
                <template v-for="(row, di) in statsHeatmap" :key="'d'+di">
                  <div class="heatmap-day">{{ dayLabels[di] }}</div>
                  <div v-for="(val, hi) in row" :key="'h'+di+'-'+hi"
                    class="heatmap-cell"
                    :style="{ background: heatColor(val) }"
                    :title="`${dayLabels[di]} ${hi}:00 — ${val} 张`">
                  </div>
                </template>
              </div>
              <div class="heatmap-hours">
                <span v-for="h in [0,3,6,9,12,15,18,21]" :key="h">{{ h }}时</span>
              </div>
              <div class="heatmap-legend">
                <span>少</span>
                <span class="legend-cell" style="background:rgba(47,54,64,0.1)"></span>
                <span class="legend-cell" style="background:rgba(47,54,64,0.3)"></span>
                <span class="legend-cell" style="background:rgba(47,54,64,0.55)"></span>
                <span class="legend-cell" style="background:rgba(47,54,64,0.85)"></span>
                <span>多</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 上传/编辑表单弹窗 -->
      <div v-if="showForm" class="modal" @click.self="showForm = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editingPhoto ? '编辑照片' : '上传照片' }}</h3>
          </div>
          <div class="modal-body">
            <!-- 图片预览区域 -->
            <div class="upload-area">
              <div v-if="form.url" class="preview">
                <img :src="form.url" />
                <button class="remove" @click="form.url = ''" title="移除">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div v-else class="upload-btn">
                <input type="file" accept="image/*" @change="handleFileSelect" />
                <span v-if="uploading">上传中...</span>
                <span v-else>点击或拖拽选择图片</span>
              </div>
            </div>

            <!-- 批量上传模式切换 -->
            <div v-if="!editingPhoto" class="upload-mode-switch">
              <button 
                type="button"
                :class="{ active: uploadMode === 'single' }"
                @click="uploadMode = 'single'; resetForm()"
              >
                单张上传
              </button>
              <button 
                type="button"
                :class="{ active: uploadMode === 'batch' }"
                @click="uploadMode = 'batch'; resetForm()"
              >
                批量上传
              </button>
            </div>

            <!-- 批量上传区域 -->
            <div v-if="uploadMode === 'batch'" class="upload-area batch-upload">
              <DragDropUpload
                :max-files="20"
                @uploaded="handleBatchUploaded"
                @uploading="handleBatchUploading"
              />
            </div>

            <!-- 表单 -->
            <form @submit.prevent="uploadMode === 'batch' ? handleBatchSave() : handleSubmit()">
              <!-- 基本信息 -->
              <div class="form-section">
                <div class="form-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  基本信息
                </div>
                <div class="form-group">
                  <label>标题</label>
                  <input v-model="form.title" type="text" placeholder="可选标题" />
                </div>
                <div class="form-group">
                  <label>心情/日记</label>
                  <textarea v-model="form.mood" placeholder="一句话日记..." rows="2"></textarea>
                </div>
              </div>

              <!-- AI 助手 -->
              <div class="form-section ai-section">
                <div class="form-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  AI 助手
                </div>
                <div class="ai-action">
                  <button type="button" class="btn-ai" @click="generateAiMetadata" :disabled="aiLoading || !form.url">
                    {{ aiLoading ? '生成中...' : 'AI 自动补全' }}
                  </button>
                  <span class="ai-hint">需先在设置中启用 AI</span>
                </div>
                <div class="form-group" v-if="aiTags.length > 0">
                  <label>AI 建议标签 <small class="hint">(点击添加)</small></label>
                  <div class="ai-tags">
                    <span
                      v-for="tag in aiTags"
                      :key="tag"
                      class="ai-tag"
                      :class="{
                        'ai-tag--added': isAiTagSelected(tag),
                        'ai-tag--clickable': !isAiTagSelected(tag)
                      }"
                      @click="!isAiTagSelected(tag) && addAiTag(tag)"
                    >
                      <span class="ai-tag-icon">{{ isAiTagSelected(tag) ? '✓' : '+' }}</span>
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 拍摄信息 -->
              <div class="form-section">
                <div class="form-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  拍摄信息
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>拍摄日期</label>
                    <input v-model="form.shot_date" type="date" />
                  </div>
                  <div class="form-group">
                    <label>地点</label>
                    <input v-model="form.location" type="text" placeholder="拍摄地点" />
                  </div>
                </div>
                <div v-if="form.camera || form.lens || form.aperture || form.shutter_speed || form.iso" class="form-group exif-group">
                  <label>相机信息（自动读取）</label>
                  <div class="exif-display">
                    <span v-if="form.camera" class="exif-item">{{ form.camera }}</span>
                    <span v-if="form.lens" class="exif-item">{{ form.lens }}</span>
                    <span v-if="form.aperture" class="exif-item">{{ form.aperture }}</span>
                    <span v-if="form.shutter_speed" class="exif-item">{{ form.shutter_speed }}</span>
                    <span v-if="form.iso" class="exif-item">ISO {{ form.iso }}</span>
                  </div>
                </div>
              </div>

              <!-- 可见性 -->
              <div class="form-section">
                <div class="form-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  可见性
                </div>
                  <div class="visibility-options">
                    <label class="radio-option">
                      <input v-model="form.visibility" type="radio" value="private" />
                      <span class="radio-label">
                        <strong>隐藏相册</strong>
                        <small>需密码验证才能查看</small>
                      </span>
                    </label>
                    <label class="radio-option">
                      <input v-model="form.visibility" type="radio" value="public" />
                      <span class="radio-label">
                        <strong>普通照片</strong>
                        <small>登录后在个人主页可见</small>
                      </span>
                    </label>
                  </div>
              </div>
              
              <!-- 标签选择 -->
              <div class="form-section">
                <div class="form-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  标签
                </div>
                <div class="tags-selector">
                  <span 
                    v-for="tag in allTags" 
                    :key="tag.id"
                    class="tag-option"
                    :class="{ selected: selectedTags.includes(tag.id) }"
                    :style="{ 
                      backgroundColor: selectedTags.includes(tag.id) ? 'var(--secondary-color)' : 'var(--hover-bg)',
                      borderColor: 'var(--secondary-color)',
                      color: selectedTags.includes(tag.id) ? '#fff' : 'var(--text-color)'
                    }"
                    @click="toggleTag(tag.id)"
                  >
                    {{ tag.name }}
                    <span class="tag-delete" @click.stop="deleteTag(tag)" title="删除标签">×</span>
                  </span>
                  <button type="button" class="add-tag-btn" @click="createTag">+ 新建标签</button>
                </div>
              </div>

              <!-- 底部操作栏 -->
              <div class="modal-footer">
                <button type="button" class="btn-cancel" @click="showForm = false">取消</button>
                <button type="submit" class="btn-submit" :disabled="uploading">
                  {{ uploading ? '上传中...' : (editingPhoto ? '保存' : (uploadMode === 'batch' && uploadedPhotos.length > 0 ? `保存 ${uploadedPhotos.length} 张` : '创建')) }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: calc(100vh - 140px);
  background: var(--bg-color);
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: 0.01em;
}

.admin-page .container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ===== 页面标题栏（对齐 Albums.vue 风格） ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(1.5rem, 2.5vw, 2rem);
  gap: 1rem;
}

.page-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.page-title {
  font-family: 'Georgia', 'Noto Serif SC', 'Songti SC', serif;
  font-size: clamp(1.5rem, 3vw, 1.875rem);
  font-weight: 300;
  letter-spacing: 0.12em;
  color: var(--text-color);
  margin: 0;
  white-space: nowrap;
}

.page-subtitle {
  font-size: 0.82rem;
  color: var(--text-tertiary);
  font-weight: 400;
  white-space: nowrap;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.page-actions .action-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 12px;
  border-radius: 17px;
  border: 1px solid var(--n-300);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
  line-height: 1;
}

.page-actions .action-pill svg {
  flex-shrink: 0;
}

.page-actions .action-pill:hover {
  border-color: var(--text-color);
  color: var(--text-color);
  background: var(--hover-bg);
}

.upload-mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.upload-mode-switch button {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid var(--n-300);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.upload-mode-switch button:hover {
  border-color: var(--text-color);
  color: var(--text-color);
}

.upload-mode-switch button.active {
  border-color: var(--secondary-color);
  background: var(--secondary-color);
  color: #fff;
}

.batch-upload {
  margin-bottom: 16px;
}

/* AI Section */
.ai-section {
  background: var(--n-200);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.ai-action {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.btn-ai {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--secondary-color);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ai:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-ai:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-hint {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.photo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.photo-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--n-200);
}

.photo-item img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
}

.photo-info {
  flex: 1;
}

.photo-info h4 { margin-bottom: 4px; }
.photo-info .photo-mood { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 4px; }
.photo-info .photo-meta { color: var(--text-tertiary); font-size: 0.8rem; }

.photo-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.photo-actions .action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--n-300);
  background: var(--card-bg);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.photo-actions .action-btn:hover {
  border-color: var(--text-color);
  color: var(--text-color);
  background: var(--hover-bg);
}

.photo-actions .action-btn-danger:hover {
  border-color: var(--danger-color);
  color: var(--danger-color);
  background: rgba(192, 57, 43, 0.08);
}

.photo-actions .visibility-toggle.public {
  color: #8B7355;
  border-color: #8B7355;
  background: rgba(139, 115, 85, 0.08);
}

.photo-actions .visibility-toggle.private {
  color: var(--text-tertiary);
  border-color: var(--n-300);
}

.visibility-group {
  margin-bottom: 16px;
}

.visibility-options {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.radio-option input {
  margin-top: 4px;
}

.radio-label {
  display: flex;
  flex-direction: column;
}

.radio-label strong {
  font-size: 0.95rem;
}

.radio-label small {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}

/* 弹窗 */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  border: 1px solid var(--n-200);
}

.modal-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--n-200);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.modal-body {
  padding: 20px 24px;
}

.modal-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--n-200);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.modal-footer .btn-cancel {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid var(--n-300);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-footer .btn-cancel:hover {
  border-color: var(--text-secondary);
  color: var(--text-color);
  background: var(--hover-bg);
}

.modal-footer .btn-submit {
  padding: 8px 24px;
  border-radius: 8px;
  border: none;
  background: var(--secondary-color);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-footer .btn-submit:hover {
  opacity: 0.88;
}

.modal-footer .btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-area {
  margin-bottom: 20px;
}

.preview {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.preview img {
  width: 100%;
  display: block;
}

.preview .remove {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.5);
  color: var(--card-bg);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
}

.upload-btn {
  border: 2px dashed var(--input-border);
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  position: relative;
}

.upload-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-btn span { color: var(--text-tertiary); }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; }
.form-group input[type="text"],
.form-group input[type="date"],
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
}

/* AI 建议标签容器 */
.ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* AI 建议标签基础样式 */
.ai-tag {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.25s ease;
  user-select: none;
}

/* 可点击状态（未添加） */
.ai-tag--clickable {
  background: rgba(139, 115, 85, 0.1);
  color: var(--secondary-color);
  border: 1.5px dashed var(--secondary-color);
  cursor: pointer;
}

.ai-tag--clickable:hover {
  background: rgba(139, 115, 85, 0.18);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(139, 115, 85, 0.2);
}

/* 已添加/选中状态 */
.ai-tag--added {
  background: rgba(139, 115, 85, 0.12);
  color: var(--secondary-color);
  border: 1.5px solid rgba(139, 115, 85, 0.35);
  cursor: default;
  opacity: 0.8;
}

/* AI 标签内的图标 */
.ai-tag-icon {
  font-size: 10px;
  font-weight: bold;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: currentColor;
  color: white;
}

/* 提示文字 */
.hint {
  color: var(--text-tertiary);
  font-weight: normal;
  font-size: 0.85rem;
}

.tags-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-option {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  color: var(--text-color);
}

.tag-option:hover {
  opacity: 0.8;
}

.tag-option.selected {
  color: var(--card-bg);
}

.add-tag-btn {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  background: var(--input-bg);
  border: 2px dashed var(--n-300);
  cursor: pointer;
  color: var(--text-secondary);
}

.add-tag-btn:hover {
  border-color: var(--secondary-color);
  color: var(--secondary-color);
}

.tag-delete {
  margin-left: 4px;
  font-size: 10px;
  opacity: 0.4;
  cursor: pointer;
  transition: opacity 0.2s;
}

.tag-delete:hover {
  opacity: 1;
  color: #e57373;
}

.exif-group { margin-bottom: 12px; }
.exif-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  background: var(--n-200);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.exif-item + .exif-item::before {
  content: '·';
  margin-right: 6px;
  color: var(--n-300);
}

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}

.form-actions .btn-cancel {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.2s;
}

.form-actions .btn-cancel:hover {
  color: var(--text-color);
}

.form-actions .btn-submit {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: var(--secondary-color);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.form-actions .btn-submit:hover {
  opacity: 0.88;
}

.form-actions .btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Form sections */
.form-section {
  margin-bottom: 20px;
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.form-section-title svg {
  opacity: 0.6;
}

/* Tabs */
.admin-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--n-200);
  margin-bottom: 20px;
}

.tab-btn {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.95rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.2s, border-color 0.2s;
}

.tab-btn:hover {
  color: var(--text-color);
}

.tab-btn.active {
  color: var(--secondary-color);
  border-bottom-color: var(--secondary-color);
  font-weight: 600;
}

/* User list */
.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: block;
  background: var(--card-bg);
  border: 1px solid var(--n-200);
  border-radius: 10px;
  overflow: hidden;
  width: 100%;
}

.user-item-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--secondary-color);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.user-info-names {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-color);
}

.user-username {
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

.user-registered {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.user-item-divider {
  height: 1px;
  background: var(--n-200);
  margin: 0 18px;
}

.user-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px 12px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 4px 10px;
  border: 1px solid var(--n-300);
  background: var(--card-bg);
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
  color: var(--text-secondary);
}

.action-btn:hover {
  border-color: var(--text-color);
  color: var(--text-color);
  background: var(--hover-bg);
}

.action-btn.danger:hover {
  color: #dc3545;
  border-color: #dc3545;
}

.role-badge {
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: auto;
}

.role-badge.user {
  background: var(--n-200);
  color: var(--text-secondary);
}

.self-tag {
  font-size: 0.78rem;
  color: var(--text-tertiary);
}

.user-stats-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.user-stat {
  font-size: 0.72rem;
  color: var(--text-tertiary);
}

.user-stat-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--n-300);
}

.inline-edit {
  padding: 3px 8px;
  border: 1px solid var(--n-300);
  border-radius: 4px;
  font-size: 0.85rem;
  background: var(--card-bg);
  color: var(--text-color);
  outline: none;
  width: 140px;
}

.inline-edit:focus {
  border-color: var(--color-primary);
}

.btn-inline {
  padding: 3px 8px;
  border: 1px solid var(--n-300);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.btn-inline.save {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.reset-pwd-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px 4px;
}

/* 分享列表 */
.share-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 8px;
  transition: box-shadow 0.15s;
}

.share-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.share-cover {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--n-200);
}

.share-cover img {
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
  color: var(--text-tertiary);
}

.share-info {
  flex: 1;
  min-width: 0;
}

.share-meta-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.tpl-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--n-200);
  padding: 1px 6px;
  border-radius: 3px;
}

.share-count {
  font-size: 0.72rem;
  color: var(--text-tertiary);
}

.share-meta-mid {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.share-meta-bottom {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.share-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-sm {
  padding: 4px 10px;
  border: 1px solid var(--n-300);
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-sm:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.btn-sm.danger:hover {
  color: #dc3545;
  border-color: #dc3545;
}

.btn-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 统计仪表盘 */
.stats-dashboard {
  padding: 20px 0;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 10px;
  padding: 18px 14px;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1.2;
}

.stat-lbl {
  font-size: 0.82rem;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.chart-section {
  background: var(--card-bg);
  border: 1px solid var(--n-300);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.chart-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 16px;
}

.chart-wrap {
  overflow-x: auto;
}

.timeline-svg {
  width: 100%;
  max-width: 600px;
  height: auto;
}

/* 热力图 */
.heatmap-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: 24px repeat(24, 1fr);
  gap: 2px;
}

.heatmap-day {
  font-size: 0.72rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 4px;
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  min-width: 12px;
  transition: transform 0.1s;
}

.heatmap-cell:hover {
  transform: scale(1.3);
  z-index: 1;
}

.heatmap-hours {
  display: grid;
  grid-template-columns: 24px repeat(24, 1fr);
  gap: 2px;
  width: 100%;
  max-width: 500px;
}

.heatmap-hours span {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  text-align: center;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--text-tertiary);
  margin-top: 8px;
}

.legend-cell {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

@media (max-width: 700px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
