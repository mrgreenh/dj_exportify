import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'

import i18n from 'i18n/config'
import PlaylistTable from './PlaylistTable'
import { handlerCalled, handlers } from '../mocks/handlers'
import * as persistence from '../persistence'

const server = setupServer(...handlers)
const onSetSubtitle = jest.fn()
const playlistId = '4XOGDpHMrVoH33uJEwHWU5'

function mockPersistence(overrides?: {
  loadStoredSaveTargetName?: string | null
  loadStoredFileHandle?: any | null
  readPersistedAppState?: persistence.PersistedAppState
}) {
  const fileHandle = overrides?.loadStoredFileHandle ?? null

  jest.spyOn(persistence, 'loadStoredSaveTargetName').mockReturnValue(overrides?.loadStoredSaveTargetName ?? null)
  jest.spyOn(persistence, 'loadStoredFileHandle').mockResolvedValue(fileHandle)
  jest.spyOn(persistence, 'readPersistedAppState').mockResolvedValue(
    overrides?.readPersistedAppState ?? persistence.emptyPersistedAppState()
  )
  jest.spyOn(persistence, 'pickSaveFileHandle').mockResolvedValue({ name: 'dj-state.json' })
  jest.spyOn(persistence, 'storeFileHandle').mockResolvedValue()
  jest.spyOn(persistence, 'storeSaveTargetName').mockImplementation(jest.fn())
  jest.spyOn(persistence, 'writePersistedAppState').mockResolvedValue()
  jest.spyOn(persistence, 'clearStoredFileHandle').mockResolvedValue()
  jest.spyOn(persistence, 'clearStoredSaveTargetName').mockImplementation(jest.fn())
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  i18n.changeLanguage('en')
  server.resetHandlers()
  handlerCalled.mockClear()
  onSetSubtitle.mockClear()
  localStorage.clear()
  jest.restoreAllMocks()
  mockPersistence()
})

test('opens a playlist detail view and loads cached tracks on update', async () => {
  const user = userEvent.setup()

  render(<PlaylistTable accessToken="TEST_ACCESS_TOKEN" onSetSubtitle={onSetSubtitle} />)

  await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')

  await user.click(screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }))

  expect(screen.getByText('No cached tracks yet. Click Update to fetch and cache this playlist.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /update/i }))

  expect(await screen.findByText('One Twos / Run Run Run')).toBeInTheDocument()
  expect(screen.getByText('2 tracks remaining')).toBeInTheDocument()
  const firstTrackRow = screen.getByText('One Twos / Run Run Run').closest('tr')
  expect(firstTrackRow).not.toBeNull()
  expect(within(firstTrackRow as HTMLElement).getByText('Ghostpoet')).toBeInTheDocument()
  expect(within(firstTrackRow as HTMLElement).getByText('2011')).toBeInTheDocument()
  expect(within(firstTrackRow as HTMLElement).getByText('22')).toBeInTheDocument()

  await user.click(screen.getAllByRole('checkbox')[0])
  expect(screen.getByText('1 track remaining')).toBeInTheDocument()
})

test('can pin playlists to the top of the list', async () => {
  const user = userEvent.setup()

  render(<PlaylistTable accessToken="TEST_ACCESS_TOKEN" onSetSubtitle={onSetSubtitle} />)

  await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')

  const rowsBefore = screen.getAllByRole('row')
  expect(within(rowsBefore[1]).getByText('Liked')).toBeInTheDocument()

  const ghostpoetRow = screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }).closest('tr')
  expect(ghostpoetRow).not.toBeNull()

  await user.click(within(ghostpoetRow as HTMLElement).getByRole('button', { name: 'Pin' }))

  await waitFor(() => {
    const rowsAfter = screen.getAllByRole('row')
    expect(within(rowsAfter[1]).getByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')).toBeInTheDocument()
  })
})

test('starts Beatport search only for tracks not marked done', async () => {
  const user = userEvent.setup()
  const documentWriteSpy = jest.fn()
  const launcherWindow = {
    document: {
      open: jest.fn(),
      write: documentWriteSpy,
      close: jest.fn()
    }
  }
  const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => launcherWindow as unknown as Window)

  render(<PlaylistTable accessToken="TEST_ACCESS_TOKEN" onSetSubtitle={onSetSubtitle} />)

  await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')

  await user.click(screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }))
  await user.click(screen.getByRole('button', { name: /update/i }))

  expect(await screen.findByText('One Twos / Run Run Run')).toBeInTheDocument()
  const uncheckedTrackCount = screen.getAllByRole('checkbox').length

  await user.click(screen.getByRole('button', { name: /start beatport search/i }))

  expect(uncheckedTrackCount).toBeGreaterThan(1)
  expect(windowOpenSpy).toHaveBeenCalledWith('', 'beatport-batch-launcher')
  expect(documentWriteSpy).toHaveBeenCalledTimes(1)
  expect(documentWriteSpy.mock.calls[0][0]).toContain('https://www.beatport.com/search?q=One%20Twos%20%2F%20Run%20Run%20Run%20Ghostpoet')
  expect(documentWriteSpy.mock.calls[0][0]).toContain('https://www.beatport.com/search?q=Us%20Against%20Whatever%20Ever%20Ghostpoet')
  expect(documentWriteSpy.mock.calls[0][0]).toContain('Console fallback')
  expect(documentWriteSpy.mock.calls[0][0]).toContain('const tracks = [')
  expect(documentWriteSpy.mock.calls[0][0]).toContain("window.open(url, '_blank');")

  await user.click(screen.getByRole('button', { name: /mark all as done/i }))

  expect(screen.getByRole('button', { name: /start beatport search/i })).toBeDisabled()
})

test('save as from the playlist list enables global autosave across updated playlists', async () => {
  const user = userEvent.setup()
  const writePersistedAppStateSpy = jest.spyOn(persistence, 'writePersistedAppState')
  const storeFileHandleSpy = jest.spyOn(persistence, 'storeFileHandle')
  const storeSaveTargetNameSpy = jest.spyOn(persistence, 'storeSaveTargetName')

  render(<PlaylistTable accessToken="TEST_ACCESS_TOKEN" onSetSubtitle={onSetSubtitle} />)

  await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')
  await user.click(screen.getByRole('button', { name: /save as/i }))

  await waitFor(() => {
    expect(storeFileHandleSpy).toHaveBeenCalledWith({ name: 'dj-state.json' })
    expect(storeSaveTargetNameSpy).toHaveBeenCalledWith('dj-state.json')
    expect(writePersistedAppStateSpy).toHaveBeenCalledTimes(1)
  })

  expect(screen.getByText('dj-state.json')).toBeInTheDocument()
  expect(screen.getByText(/global autosave stores every playlist you update in this json file/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }))

  await user.click(screen.getByRole('button', { name: /update/i }))

  expect(await screen.findByText('One Twos / Run Run Run')).toBeInTheDocument()

  await waitFor(() => {
    expect(writePersistedAppStateSpy).toHaveBeenCalledTimes(2)
  })

  await user.click(screen.getByRole('button', { name: /back to playlists/i }))
  await user.click(screen.getByRole('button', { name: 'Liked' }))
  await user.click(screen.getByRole('button', { name: /update/i }))

  await waitFor(() => {
    expect(writePersistedAppStateSpy).toHaveBeenCalledTimes(3)
  })

  expect(writePersistedAppStateSpy).toHaveBeenLastCalledWith(
    { name: 'dj-state.json' },
    expect.objectContaining({
      playlistsById: expect.objectContaining({
        [playlistId]: expect.any(Object),
        liked: expect.any(Object)
      })
    })
  )

  await user.click(screen.getByRole('button', { name: /back to playlists/i }))
  await user.click(screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }))

  writePersistedAppStateSpy.mockClear()

  await user.click(screen.getAllByRole('checkbox')[0])

  await waitFor(() => {
    expect(writePersistedAppStateSpy).toHaveBeenCalledTimes(1)
  })

  expect(writePersistedAppStateSpy).toHaveBeenLastCalledWith(
    { name: 'dj-state.json' },
    expect.objectContaining({
      playlistsById: expect.objectContaining({
        [playlistId]: expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({
              title: 'One Twos / Run Run Run',
              done: true
            })
          ])
        })
      })
    })
  )
})

test('restores save destination and cached playlist data on reload', async () => {
  const restoredState: persistence.PersistedAppState = {
    version: 1,
    pinnedPlaylistIds: [playlistId],
    playlistsById: {
      [playlistId]: {
        playlistId,
        playlistName: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam',
        ownerName: 'watsonbox',
        snapshotId: 'snapshot',
        updatedAt: '2025-01-01T12:00:00.000Z',
        tracks: [{
          id: 'restored-track-1',
          uri: 'spotify:track:7ATyvp3TmYBmGW7YuC8DJ3',
          title: 'One Twos / Run Run Run',
          artist: 'Ghostpoet',
          releaseDate: '2011',
          popularity: 22,
          done: false,
          addedAt: '2020-11-03T15:19:04Z'
        }]
      }
    }
  }

  jest.spyOn(persistence, 'loadStoredSaveTargetName').mockReturnValue('dj-state.json')
  jest.spyOn(persistence, 'loadStoredFileHandle').mockResolvedValue({ name: 'dj-state.json' })
  jest.spyOn(persistence, 'readPersistedAppState').mockResolvedValue(restoredState)

  const user = userEvent.setup()

  render(<PlaylistTable accessToken="TEST_ACCESS_TOKEN" onSetSubtitle={onSetSubtitle} />)

  await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')

  expect(screen.getByText('dj-state.json')).toBeInTheDocument()

  const rows = screen.getAllByRole('row')
  expect(within(rows[1]).getByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }))

  expect(await screen.findByText('One Twos / Run Run Run')).toBeInTheDocument()
  expect(screen.getByText(/global autosave enabled: dj-state.json/i)).toBeInTheDocument()
})

test('keeps remembered save file on startup permission error and reconnects on click', async () => {
  const restoredState: persistence.PersistedAppState = {
    version: 1,
    pinnedPlaylistIds: [playlistId],
    playlistsById: {
      [playlistId]: {
        playlistId,
        playlistName: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam',
        ownerName: 'watsonbox',
        snapshotId: 'snapshot',
        updatedAt: '2025-01-01T12:00:00.000Z',
        tracks: [{
          id: 'restored-track-1',
          uri: 'spotify:track:7ATyvp3TmYBmGW7YuC8DJ3',
          title: 'One Twos / Run Run Run',
          artist: 'Ghostpoet',
          releaseDate: '2011',
          popularity: 22,
          done: false,
          addedAt: '2020-11-03T15:19:04Z'
        }]
      }
    }
  }

  jest.spyOn(persistence, 'loadStoredSaveTargetName').mockReturnValue('dj-state.json')
  jest.spyOn(persistence, 'loadStoredFileHandle').mockResolvedValue({ name: 'dj-state.json' })
  const readPersistedAppStateSpy = jest.spyOn(persistence, 'readPersistedAppState')
    .mockRejectedValueOnce(new persistence.FilePermissionRequiredError('Saved file is remembered, but the browser needs a click before it can be read again.'))
    .mockResolvedValueOnce(restoredState)

  const user = userEvent.setup()

  render(<PlaylistTable accessToken="TEST_ACCESS_TOKEN" onSetSubtitle={onSetSubtitle} />)

  await screen.findByText('Ghostpoet – Peanut Butter Blues and Melancholy Jam')

  expect(screen.getByText('dj-state.json')).toBeInTheDocument()
  expect(screen.getByText(/browser needs a click before it can be read again/i)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /reconnect saved file/i }).length).toBeGreaterThan(0)

  await user.click(screen.getAllByRole('button', { name: /reconnect saved file/i })[0])

  expect(readPersistedAppStateSpy).toHaveBeenCalledTimes(2)

  await user.click(screen.getByRole('button', { name: 'Ghostpoet – Peanut Butter Blues and Melancholy Jam' }))
  expect(await screen.findByText('One Twos / Run Run Run')).toBeInTheDocument()
})
