// 相册相关 API

const API_BASE = '/api/albums'

export const albums = {
  // 获取相册列表
  async list(params = {}) {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    if (params.user_id) query.append('user_id', params.user_id)

    const url = `${API_BASE}${query.toString() ? '?' + query.toString() : ''}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (!res.ok) throw new Error('获取相册列表失败')
    return res.json()
  },

  // 获取相册详情
  async get(id) {
    const res = await fetch(`${API_BASE}/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (!res.ok) throw new Error('获取相册详情失败')
    return res.json()
  },

  // 创建相册
  async create(data) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '创建相册失败')
    }
    return res.json()
  },

  // 更新相册
  async update(id, data) {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '更新相册失败')
    }
    return res.json()
  },

  // 删除相册
  async delete(id) {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '删除相册失败')
    }
    return res.json()
  },

  // 添加照片到相册
  async addPhoto(albumId, photoId) {
    const res = await fetch(`${API_BASE}/${albumId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ photo_id: photoId })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '添加照片失败')
    }
    return res.json()
  },

  // 从相册移除照片
  async removePhoto(albumId, photoId) {
    const res = await fetch(`${API_BASE}/${albumId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '移除照片失败')
    }
    return res.json()
  },

  // 设置封面
  async setCover(albumId, photoId) {
    const res = await fetch(`${API_BASE}/${albumId}/cover`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ photo_id: photoId })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '设置封面失败')
    }
    return res.json()
  }
}
