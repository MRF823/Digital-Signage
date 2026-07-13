import axios from 'axios'

const BASE = `http://${window.location.hostname}:4000`

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
export const renameAgency = (id, name, city) => api.patch(`/api/agencies/${id}/name`, { name, city }).then(r => r.data)
export const updateAgencyCoords = (agencyId, lat, lng) => api.patch(`/api/agencies/${agencyId}/coords`, { lat, lng }).then(r => r.data)
export const addTv = (agencyId, label, orientation = 'landscape') => api.post(`/api/agencies/${agencyId}/tvs`, { label, orientation }).then(r => r.data)
export const updateTvOrientation = (agencyId, tvId, orientation) => api.patch(`/api/agencies/${agencyId}/tvs/${tvId}`, { orientation }).then(r => r.data)
export const deleteTv = (tvId) => api.delete(`/api/tvs/${tvId}`)
export const getPlaylist = (agencyId) => api.get(`/api/agencies/${agencyId}/playlist`).then(r => r.data)
export const setPlaylist = (agencyId, items) =>
  api.post(`/api/agencies/${agencyId}/playlist`, { items }).then(r => r.data)

export const getGroups = () => api.get('/api/groups').then(r => r.data)
export const createGroup = (name) => api.post('/api/groups', { name }).then(r => r.data)
export const deleteGroup = (id) => api.delete(`/api/groups/${id}`)
export const renameGroup = (id, name) => api.patch(`/api/groups/${id}/name`, { name }).then(r => r.data)
export const addAgencyToGroup = (groupId, agencyId) =>
  api.post(`/api/groups/${groupId}/agencies`, { agency_id: agencyId }).then(r => r.data)
export const removeAgencyFromGroup = (groupId, agencyId) =>
  api.delete(`/api/groups/${groupId}/agencies/${agencyId}`)
export const getGroupPlaylist = (groupId) =>
  api.get(`/api/groups/${groupId}/playlist`).then(r => r.data)
export const setGroupPlaylist = (groupId, items) =>
  api.post(`/api/groups/${groupId}/playlist`, { items }).then(r => r.data)

export const updateGroupTransition = (groupId, transition) =>
  api.patch(`/api/groups/${groupId}`, { transition }).then(r => r.data)

export const updateGroupPower = (groupId, power_on_time, power_off_time) =>
  api.patch(`/api/groups/${groupId}`, { power_on_time, power_off_time }).then(r => r.data)

export const getSchedules = (groupId) => api.get(`/api/groups/${groupId}/schedules`).then(r => r.data)
export const createSchedule = (groupId, data) => api.post(`/api/groups/${groupId}/schedules`, data).then(r => r.data)
export const updateSchedule = (groupId, slotId, data) => api.put(`/api/groups/${groupId}/schedules/${slotId}`, data).then(r => r.data)
export const deleteSchedule = (groupId, slotId) => api.delete(`/api/groups/${groupId}/schedules/${slotId}`)

export const getCampaigns = () => api.get('/api/campaigns').then(r => r.data)
export const getCampaignsByAgency = (agencyId) => api.get(`/api/campaigns/${agencyId}`).then(r => r.data)
export const createCampaign = (data) => api.post('/api/campaigns', data).then(r => r.data)
export const deleteCampaign = (id) => api.delete(`/api/campaigns/${id}`)

export const getRates = () => api.get('/api/rates').then(r => r.data)

export const getPlayLog = (params = {}) =>
  api.get('/api/play-log', { params }).then(r => r.data)

export const getStats = () => api.get('/api/stats').then(r => r.data)
export const reloadPlayers = () => api.post('/api/players/reload').then(r => r.data)

export const mediaUrl = (filename) => `${BASE}/api/media/${filename}`

export default api
