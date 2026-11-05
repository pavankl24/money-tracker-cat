import { createClient } from '@supabase/supabase-js'

export type CloudTx = { id: number; type: 'in' | 'out'; amt: number; note: string; date: string }
export type CloudState = { limit: number; cur: string; name: string; theme: '' | 'light' | 'dark'; tx: CloudTx[] }

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

/** Merge local and cloud data without deleting either side's transactions. */
export function mergeStates(local: CloudState, remote: CloudState): CloudState {
  const tx = [...local.tx]
  const seen = new Set(tx.map(item => item.id))
  let nextId = Math.max(Date.now(), ...tx.map(item => item.id), ...remote.tx.map(item => item.id))

  for (const item of remote.tx) {
    const sameId = tx.find(existing => existing.id === item.id)
    if (!sameId) {
      tx.push(item)
      seen.add(item.id)
    } else if (sameId.type !== item.type || sameId.amt !== item.amt || sameId.note !== item.note || sameId.date !== item.date) {
      while (seen.has(nextId)) nextId += 1
      tx.push({ ...item, id: ++nextId })
      seen.add(nextId)
    }
  }

  return {
    limit: local.limit || remote.limit,
    cur: local.cur || remote.cur,
    name: local.name || remote.name,
    theme: local.theme || remote.theme,
    tx: tx.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
  }
}

export function isCloudState(value: unknown): value is CloudState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<CloudState>
  return Array.isArray(state.tx) && typeof state.limit === 'number' && typeof state.cur === 'string'
}
