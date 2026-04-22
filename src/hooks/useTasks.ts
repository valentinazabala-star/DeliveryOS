import { useEffect, useState } from 'react'
import { supabase, subscribeToTasks } from '@/lib/supabase'

export interface SupabaseTask {
  id: string
  name: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  type: string | null
  account_id: string | null
  assigned_user_id: string | null
  created_at: string
  assigned_at: string | null
  closed_at: string | null
}

export function useTasks() {
  const [tasks, setTasks] = useState<SupabaseTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()

    const channel = subscribeToTasks(() => {
      fetchTasks()
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { tasks, loading, error, refetch: fetchTasks }
}
