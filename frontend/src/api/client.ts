import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail
    let message: string
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg, type}]
      message = detail.map((e: { loc?: string[]; msg?: string }) =>
        e.loc ? `${e.loc.join('.')}: ${e.msg}` : e.msg ?? JSON.stringify(e)
      ).join('; ')
    } else {
      message = err.message ?? 'Unknown error'
    }
    return Promise.reject(new Error(message))
  },
)

export default api
