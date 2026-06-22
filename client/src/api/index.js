import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000
})

// 请求拦截器
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：ECONNREFUSED 自动重试一次（后端启动慢/重启中）
api.interceptors.response.use(
  response => response.data,
  async error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
    }

    // 后端未就绪时自动重试一次
    const isConnRefused = error.code === 'ERR_NETWORK' || error.message?.includes('ECONNREFUSED')
    const config = error.config
    if (isConnRefused && config && !config.__retried) {
      config.__retried = true
      await new Promise(r => setTimeout(r, 1500))
      return api.request(config)
    }

    return Promise.reject(error)
  }
)

// 认证
export const auth = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (username, password, nickname) => api.post('/auth/register', { username, password, nickname }),
  getMe: () => api.get('/auth/me'),
  changePassword: (oldPassword, newPassword) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),
  verifyHiddenPassword: (password) => api.post('/auth/verify-hidden-password', { password })
}

// 用户
export const users = {
  getProfile: (id) => api.get(`/users/${id}`),
  getUserPhotos: (id, params) => api.get(`/users/${id}/photos`, { params }),
  updateProfile: (data) => api.put('/users/profile', data),
  list: (params) => api.get('/users', { params }),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  getHiddenPasswordStatus: () => api.get('/users/hidden-password/status'),
  setHiddenPassword: (password, currentPassword) => api.put('/users/hidden-password', { password, currentPassword }),
  removeHiddenPassword: (password) => api.delete('/users/hidden-password', { data: { password } })
}

// 照片
export const photos = {
  list: (params) => api.get('/photos', { params }),
  get: (id) => api.get(`/photos/${id}`),
  getRandomDiary: () => api.get('/photos/random/diary'),
  getTimelineStats: () => api.get('/photos/stats/timeline'),
  getReview: (year, options = {}) => api.get(`/review/${year}`, { params: options }),
  getReviewYears: () => api.get('/review/years'),
  getMyPhotos: (params) => api.get('/photos/my/list', { params }),
  getAdminPhotos: (params) => api.get('/photos/admin/all', { params }),
  getHiddenPhotos: (params, hiddenToken) => api.get('/photos/hidden', {
    params: { ...params, hidden_token: hiddenToken }
  }),
  create: (data) => api.post('/photos', data),
  update: (id, data) => api.put(`/photos/${id}`, data),
  delete: (id) => api.delete(`/photos/${id}`)
}

// 收藏（登录用户自动使用 user_id，未登录使用 fingerprint）
export const favorites = {
  list: () => api.get('/favorites'),
  check: (photoId, fingerprint) =>
    api.get('/favorites/check', { params: { photo_id: photoId, fingerprint } }),
  add: (photoId, fingerprint) =>
    api.post('/favorites', { photo_id: photoId, fingerprint }),
  remove: (photoId) =>
    api.delete(`/favorites/${photoId}`)
}

// 上传
export const upload = {
  single: (file) => {
    const formData = new FormData()
    formData.append('photo', file)
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  multiple: (files) => {
    const formData = new FormData()
    files.forEach(file => formData.append('photos', file))
    return api.post('/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

// 标签
export const tags = {
  list: () => api.get('/tags'),
  getPopular: (limit) => api.get('/tags/popular', { params: { limit } }),
  create: (data) => api.post('/tags', data),
  delete: (id) => api.delete(`/tags/${id}`),
  getPhotoTags: (photoId) => api.get(`/tags/photo/${photoId}`),
  setPhotoTags: (photoId, tagIds) => api.post(`/tags/photo/${photoId}`, { tagIds })
}

// AI
export const ai = {
  getConfig: () => api.get('/ai/config'),
  saveConfig: (data) => api.post('/ai/config', data),
  getOllamaModels: () => api.get('/ai/ollama/models'),
  generateMetadata: (data) => api.post('/ai/metadata', data),
  rewriteSearch: (q) => api.get('/ai/search', { params: { q } }),
  getPresets: () => api.get('/ai/presets'),
  createPreset: (data) => api.post('/ai/presets', data),
  updatePreset: (id, data) => api.put(`/ai/presets/${id}`, data),
  activatePreset: (id) => api.put(`/ai/presets/${id}/activate`),
  deletePreset: (id) => api.delete(`/ai/presets/${id}`),
  testConnection: () => api.post('/ai/test')
}

// 故事线
export const storylines = {
  list: (params) => api.get('/storylines', { params }),
  getDetail: (date, location) => api.get(`/storylines/${encodeURIComponent(date)}/${encodeURIComponent(location)}`),
  generateSummary: (date, location, body) => api.post(`/storylines/${encodeURIComponent(date)}/${encodeURIComponent(location)}/summary`, body || {})
}

// 统计
export const stats = {
  get: () => api.get('/stats')
}

// 分享卡片
export const share = {
  create: (data) => api.post('/share', data),
  get: (shareId) => api.get(`/share/${shareId}`),
  delete: (shareId) => api.delete(`/share/${shareId}`)
}

// 相册
export { albums } from './albums'

export default api
