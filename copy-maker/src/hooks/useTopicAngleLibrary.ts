import { useCallback, useState } from 'react'
import { TOPIC_ANGLE_PRESETS, type TopicAnglePreset } from '../lib/topicAngleRandomTopic'

/** Browser key for edited angle presets (bundled JSON is the default until you Save here). */
const STORAGE_KEY = 'copy-maker-topic-angle-presets-v1'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * Validates the angle library JSON the user edits in the gear popover.
 * Each entry needs id, name, and pattern (strings). archetypes and summary are optional.
 */
function parseAngleLibraryJson(json: string): { ok: true; presets: TopicAnglePreset[] } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: e instanceof SyntaxError ? e.message : 'Invalid JSON' }
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: 'Root must be an array of angle objects.' }
  }
  const presets: TopicAnglePreset[] = []
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!isRecord(row)) {
      return { ok: false, error: `Item ${i}: must be an object.` }
    }
    const id = row['id']
    const name = row['name']
    const pattern = row['pattern']
    if (typeof id !== 'string' || !id.trim()) {
      return { ok: false, error: `Item ${i}: missing non-empty string "id".` }
    }
    if (typeof name !== 'string' || !name.trim()) {
      return { ok: false, error: `Item ${i}: missing non-empty string "name".` }
    }
    if (typeof pattern !== 'string' || !pattern.trim()) {
      return { ok: false, error: `Item ${i}: missing non-empty string "pattern".` }
    }
    const archetypes = typeof row['archetypes'] === 'string' ? row['archetypes'] : ''
    const summary = typeof row['summary'] === 'string' ? row['summary'] : ''
    presets.push({
      id: id.trim(),
      name: name.trim(),
      archetypes,
      summary,
      pattern: pattern.trim(),
    })
  }
  if (presets.length === 0) {
    return { ok: false, error: 'Add at least one angle object.' }
  }
  return { ok: true, presets }
}

function loadCommittedFromStorage(): TopicAnglePreset[] {
  if (typeof localStorage === 'undefined') {
    return [...TOPIC_ANGLE_PRESETS]
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw?.trim()) {
      return [...TOPIC_ANGLE_PRESETS]
    }
    const r = parseAngleLibraryJson(raw)
    return r.ok ? r.presets : [...TOPIC_ANGLE_PRESETS]
  } catch {
    return [...TOPIC_ANGLE_PRESETS]
  }
}

/**
 * Editable angle library: defaults from `topicAnglePresets.json`, overrides saved in localStorage.
 * Generate uses `committedPresets` only after a successful Save.
 */
export function useTopicAngleLibrary() {
  const [committed, setCommitted] = useState<TopicAnglePreset[]>(loadCommittedFromStorage)
  const [draftJson, setDraftJson] = useState(() => JSON.stringify(loadCommittedFromStorage(), null, 2))
  const [saveError, setSaveError] = useState<string | null>(null)

  /** When opening the gear menu, reset the textarea to the last saved library (drops unsaved edits). */
  const syncDraftFromCommitted = useCallback(() => {
    setDraftJson(JSON.stringify(committed, null, 2))
    setSaveError(null)
  }, [committed])

  const saveDraft = useCallback((): boolean => {
    const r = parseAngleLibraryJson(draftJson)
    if (!r.ok) {
      setSaveError(r.error)
      return false
    }
    try {
      localStorage.setItem(STORAGE_KEY, draftJson.trim())
    } catch {
      setSaveError('Could not save to browser storage (quota or private mode).')
      return false
    }
    setCommitted(r.presets)
    setSaveError(null)
    return true
  }, [draftJson])

  const resetToDefaults = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    const next = [...TOPIC_ANGLE_PRESETS]
    setCommitted(next)
    setDraftJson(JSON.stringify(next, null, 2))
    setSaveError(null)
  }, [])

  return {
    committedPresets: committed,
    draftJson,
    setDraftJson,
    saveDraft,
    resetToDefaults,
    syncDraftFromCommitted,
    saveError,
  }
}
