import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

export async function testConnection() {
  const { data, error } = await supabase.from('tasks').select('*')
  console.log('DATA:', data)
  console.log('ERROR:', error)
  return { data, error }
}

export function subscribeToTasks(onchange: (payload: unknown) => void) {
  return supabase
    .channel('tasks')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      onchange
    )
    .subscribe()
}
