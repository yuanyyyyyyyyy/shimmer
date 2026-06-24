import api from './index'

const endpoint = '/albums'

export const albums = {
  list: (params) => api.get(endpoint, { params }),
  get: (id) => api.get(`${endpoint}/${id}`),
  create: (data) => api.post(endpoint, data),
  update: (id, data) => api.put(`${endpoint}/${id}`, data),
  delete: (id) => api.delete(`${endpoint}/${id}`),
  addPhoto: (albumId, photoId) => api.post(`${endpoint}/${albumId}/photos`, { photo_id: photoId }),
  removePhoto: (albumId, photoId) => api.delete(`${endpoint}/${albumId}/photos/${photoId}`),
  setCover: (albumId, photoId) => api.put(`${endpoint}/${albumId}/cover`, { photo_id: photoId })
}
