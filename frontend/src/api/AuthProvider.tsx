import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { AuthContext, type AuthContextValue } from './auth.context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      refreshing,
      authError,
      signInWithEmail: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUpWithEmail: async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
      resetPasswordWithEmail: async (email: string, redirectTo?: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
        if (error) throw error
      },
      updatePassword: async (password: string) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      },
      refreshSession: async () => {
        setRefreshing(true)
        setAuthError(null)
        const { data, error } = await supabase.auth.getSession()
        if (error) setAuthError(error.message)
        setSession(data.session)
        setRefreshing(false)
      },
    }),
    [session, loading, refreshing, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
