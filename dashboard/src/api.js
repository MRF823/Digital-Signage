import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const login = (username, password) =>
  api.post('/api/login', { username, password }).then(r => r.data)

export const getMedia = () => api.get('/api/media').then(r => r.data)
export const uploadMedia = (file, onProgress) =>
  api.post('/api/media/upload', (() => { const f = new FormData(); f.append('file', file); return f })(), {
    onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  }).then(r => r.data)
export const deleteMedia = (id) => api.delete(`/api/media/${id}`)

export const getAgencies = () => api.get('/api/agencies').then(r => r.data)
export const createAgency = (name, city) => api.post('/api/agencies', { name, city }).then(r => r.data)
export const deleteAgency = (id) => api.delete(`/api/agencies/${id}`)
export const addTv = (agencyId, label) => api.post(`/api/agencies/${agencyId}/tvs`, { label }).then(r => r.data)
export const deleteTv = (tvId) => api.delete(`/api/tvs/${tvId}`)
export const getPlaylist = (agencyId) => api.get(`/api/agencies/${agencyId}/playlist`).then(r => r.data)
export const setPlaylist = (agencyId, items) =>
  api.post(`/api/agencies/${agencyId}/playlist`, { items }).then(r => r.data)

export const mediaUrl = (filename) => `${BASE}/api/media/${filename}`

export default api
