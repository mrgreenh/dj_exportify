import {
  emptyPersistedAppState,
  isTrackDone,
  normalizePersistedAppState,
  PERSISTED_APP_STATE_VERSION,
  setTracksDone
} from './persistence'

const track = (id: string, uri: string, done?: boolean) => ({
  id,
  uri,
  title: `Title ${id}`,
  artist: 'Artist',
  releaseDate: '2020',
  popularity: 1,
  addedAt: '2020-01-01T00:00:00Z',
  ...(done === undefined ? {} : { done })
})

test('migrates version 1 per-playlist done flags into a single global set', () => {
  const state = normalizePersistedAppState({
    version: 1,
    pinnedPlaylistIds: [],
    playlistsById: {
      a: { playlistId: 'a', playlistName: 'A', ownerName: 'o', updatedAt: '', tracks: [track('a-1', 'spotify:track:x', true), track('a-2', 'spotify:track:y', false)] },
      b: { playlistId: 'b', playlistName: 'B', ownerName: 'o', updatedAt: '', tracks: [track('b-1', 'spotify:track:x', false), track('b-2', 'spotify:track:z', true)] }
    }
  })

  expect(state.version).toBe(PERSISTED_APP_STATE_VERSION)
  expect(state.doneTrackUris.sort()).toEqual(['spotify:track:x', 'spotify:track:z'])
  expect(Object.values(state.playlistsById).flatMap((playlist) => playlist.tracks)).not.toContainEqual(expect.objectContaining({ done: expect.anything() }))
  expect(isTrackDone(state, state.playlistsById.b.tracks[0])).toBe(true)
  expect(isTrackDone(state, state.playlistsById.a.tracks[1])).toBe(false)
})

test('keeps version 2 doneTrackUris and falls back to the track id when there is no uri', () => {
  const state = normalizePersistedAppState({
    version: 2,
    pinnedPlaylistIds: [],
    doneTrackUris: ['spotify:track:x'],
    playlistsById: {
      a: { playlistId: 'a', playlistName: 'A', ownerName: 'o', updatedAt: '', tracks: [track('local-1', '')] }
    }
  })

  expect(state.doneTrackUris).toEqual(['spotify:track:x'])
  expect(isTrackDone(state, state.playlistsById.a.tracks[0])).toBe(false)
  expect(isTrackDone(setTracksDone(state, state.playlistsById.a.tracks, true), state.playlistsById.a.tracks[0])).toBe(true)
})

test('setTracksDone adds and removes tracks without duplicates', () => {
  const tracks = [track('1', 'spotify:track:x'), track('2', 'spotify:track:x'), track('3', 'spotify:track:y')]
  const done = setTracksDone(emptyPersistedAppState(), tracks, true)

  expect(done.doneTrackUris).toEqual(['spotify:track:x', 'spotify:track:y'])
  expect(setTracksDone(done, [tracks[1]], false).doneTrackUris).toEqual(['spotify:track:y'])
})
