import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pack61_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pack61_token')
    if (token) {
      api.get('/auth/me').then(r => {
        setUser(r.data.user)
        localStorage.setItem('pack61_user', JSON.stringify(r.data.user))
      }).catch(() => {
        localStorage.removeItem('pack61_token')
        localStorage.removeItem('pack61_user')
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password })
    localStorage.setItem('pack61_token', r.data.token)
    localStorage.setItem('pack61_user', JSON.stringify(r.data.user))
    setUser(r.data.user)
    return r.data.user
  }

  const logout = () => {
    localStorage.removeItem('pack61_token')
    localStorage.removeItem('pack61_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
