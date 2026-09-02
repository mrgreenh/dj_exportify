export interface PersistedTrackState {
  id: string
  uri: string
  title: string
  artist: string
  releaseDate: string
  popularity: number
  addedAt: string
}

export interface PersistedPlaylistState {
  playlistId: string
  playlistName: string
  ownerName: string
  snapshotId?: string
  updatedAt: string
  tracks: PersistedTrackState[]
}

export interface PersistedAppState {
  version: number
  pinnedPlaylistIds: string[]
  /**
   * Single source of truth for the "done" state of a track, keyed by track URI
   * (see `trackDoneKey`). A track is done everywhere it appears, regardless of
   * which playlist it was marked in and whether other playlists have been
   * refreshed since.
   */
  doneTrackUris: string[]
  playlistsById: Record<string, PersistedPlaylistState>
}

export const PERSISTED_APP_STATE_VERSION = 2

export class FilePermissionRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FilePermissionRequiredError'
  }
}

const DB_NAME = 'dj-exportify'
const DB_VERSION = 1
const STORE_NAME = 'appState'
const HANDLE_KEY = 'fileHandle'
const SAVE_TARGET_NAME_KEY = 'djExportify.saveTargetName'

export const emptyPersistedAppState = (): PersistedAppState => ({
  version: PERSISTED_APP_STATE_VERSION,
  pinnedPlaylistIds: [],
  doneTrackUris: [],
  playlistsById: {}
})

/** Key under which a track's done state is stored. Falls back to the track id for tracks without a URI. */
export function trackDoneKey(track: Pick<PersistedTrackState, 'id' | 'uri'>): string {
  return track.uri || track.id
}

export function isTrackDone(state: Pick<PersistedAppState, 'doneTrackUris'>, track: Pick<PersistedTrackState, 'id' | 'uri'>): boolean {
  return state.doneTrackUris.includes(trackDoneKey(track))
}

export function setTracksDone(state: PersistedAppState, tracks: Array<Pick<PersistedTrackState, 'id' | 'uri'>>, done: boolean): PersistedAppState {
  const doneTrackUris = new Set(state.doneTrackUris)

  tracks.forEach((track) => {
    if (done) {
      doneTrackUris.add(trackDoneKey(track))
    } else {
      doneTrackUris.delete(trackDoneKey(track))
    }
  })

  return { ...state, doneTrackUris: Array.from(doneTrackUris) }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T> | T): Promise<T | null> {
  const database = await openDatabase()

  if (!database) {
    return null
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    let callbackResult: T | null = null

    transaction.oncomplete = () => resolve(callbackResult)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)

    Promise.resolve(callback(store))
      .then((result) => {
        callbackResult = result
      })
      .catch(reject)
  })
}

function normalizeTrack(track: any, legacyDoneKeys: Set<string>): PersistedTrackState | null {
  if (!track || typeof track !== 'object') {
    return null
  }

  const normalizedTrack: PersistedTrackState = {
    id: String(track.id || ''),
    uri: String(track.uri || ''),
    title: String(track.title || ''),
    artist: String(track.artist || ''),
    releaseDate: String(track.releaseDate || ''),
    popularity: Number(track.popularity || 0),
    addedAt: String(track.addedAt || '')
  }

  // Version 1 files stored `done` on each playlist track. Migrate any such
  // flag into the global set so a track done in one playlist is done in all.
  if (track.done) {
    legacyDoneKeys.add(trackDoneKey(normalizedTrack))
  }

  return normalizedTrack
}

function normalizePlaylist(playlist: any, legacyDoneKeys: Set<string>): PersistedPlaylistState | null {
  if (!playlist || typeof playlist !== 'object') {
    return null
  }

  const tracks = Array.isArray(playlist.tracks)
    ? playlist.tracks.map((track: any) => normalizeTrack(track, legacyDoneKeys)).filter(Boolean) as PersistedTrackState[]
    : []

  return {
    playlistId: String(playlist.playlistId || ''),
    playlistName: String(playlist.playlistName || ''),
    ownerName: String(playlist.ownerName || ''),
    snapshotId: playlist.snapshotId == null ? undefined : String(playlist.snapshotId),
    updatedAt: String(playlist.updatedAt || ''),
    tracks
  }
}

export function normalizePersistedAppState(value: any): PersistedAppState {
  const fallback = emptyPersistedAppState()

  if (!value || typeof value !== 'object') {
    return fallback
  }

  const doneKeys = new Set<string>(
    Array.isArray(value.doneTrackUris)
      ? value.doneTrackUris.map((uri: any) => String(uri)).filter(Boolean)
      : []
  )

  const playlistsByIdEntries = Object.entries(value.playlistsById || {})
    .map(([playlistId, playlist]) => {
      const normalizedPlaylist = normalizePlaylist(playlist, doneKeys)

      if (!normalizedPlaylist || !playlistId) {
        return null
      }

      return [playlistId, normalizedPlaylist] as const
    })
    .filter(Boolean) as Array<readonly [string, PersistedPlaylistState]>

  return {
    version: PERSISTED_APP_STATE_VERSION,
    pinnedPlaylistIds: Array.isArray(value.pinnedPlaylistIds)
      ? value.pinnedPlaylistIds.map((playlistId: any) => String(playlistId))
      : fallback.pinnedPlaylistIds,
    doneTrackUris: Array.from(doneKeys),
    playlistsById: Object.fromEntries(playlistsByIdEntries)
  }
}

async function getHandle(): Promise<any | null> {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(HANDLE_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  })
}

export async function loadStoredFileHandle(): Promise<any | null> {
  return getHandle()
}

export async function storeFileHandle(handle: any): Promise<void> {
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.put(handle, HANDLE_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
}

export async function clearStoredFileHandle(): Promise<void> {
  await withStore('readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(HANDLE_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })
}

export function loadStoredSaveTargetName(): string | null {
  return localStorage.getItem(SAVE_TARGET_NAME_KEY)
}

export function storeSaveTargetName(name: string): void {
  localStorage.setItem(SAVE_TARGET_NAME_KEY, name)
}

export function clearStoredSaveTargetName(): void {
  localStorage.removeItem(SAVE_TARGET_NAME_KEY)
}

async function ensurePermission(handle: any, mode: 'read' | 'readwrite', requestIfNeeded = true) {
  if (!handle || typeof handle.queryPermission !== 'function') {
    return true
  }

  const currentPermission = await handle.queryPermission({ mode })

  if (currentPermission === 'granted') {
    return true
  }

  if (!requestIfNeeded) {
    return false
  }

  if (typeof handle.requestPermission !== 'function') {
    return false
  }

  return (await handle.requestPermission({ mode })) === 'granted'
}

export async function pickSaveFileHandle(): Promise<any> {
  const picker = (window as any).showSaveFilePicker

  if (typeof picker !== 'function') {
    throw new Error('File System Access API is not available in this browser.')
  }

  return picker({
    suggestedName: 'dj-exportify-state.json',
    types: [{
      description: 'JSON files',
      accept: {
        'application/json': ['.json']
      }
    }]
  })
}

export async function readPersistedAppState(handle: any, options?: { requestPermission?: boolean }): Promise<PersistedAppState> {
  if (!handle) {
    return emptyPersistedAppState()
  }

  const hasPermission = await ensurePermission(handle, 'read', options?.requestPermission !== false)

  if (!hasPermission) {
    throw new FilePermissionRequiredError(
      options?.requestPermission === false
        ? 'Saved file is remembered, but the browser needs a click before it can be read again.'
        : 'Read access to the saved state file was denied.'
    )
  }

  const file = await handle.getFile()
  const content = await file.text()

  if (content.trim().length === 0) {
    return emptyPersistedAppState()
  }

  return normalizePersistedAppState(JSON.parse(content))
}

export async function writePersistedAppState(handle: any, state: PersistedAppState): Promise<void> {
  if (!handle) {
    throw new Error('No save destination selected.')
  }

  const hasPermission = await ensurePermission(handle, 'readwrite')

  if (!hasPermission) {
    throw new Error('Write access to the saved state file was denied.')
  }

  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(normalizePersistedAppState(state), null, 2))
  await writable.close()
}
