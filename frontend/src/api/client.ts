import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message: string =
      err.response?.data?.detail ?? err.message ?? 'Unknown error'
    return Promise.reject(new Error(message))
  },
)

export default api
