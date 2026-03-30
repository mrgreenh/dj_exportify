import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { PlaylistDetail } from './PlaylistDetail'
import i18n from '../i18n/config'

test('opens Beatport search for a single track from the playlist detail', async () => {
  i18n.changeLanguage('en')

  const onOpenTrackBeatportSearch = jest.fn()

  render(
    <PlaylistDetail
      playlist={{
        id: 'playlist-1',
        name: 'My Playlist',
        owner: { display_name: 'Carlo' }
      }}
      playlistState={{
        playlistId: 'playlist-1',
        playlistName: 'My Playlist',
        ownerName: 'Carlo',
        updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
        tracks: [
          {
            id: 'track-1',
            uri: 'spotify:track:track-1',
            title: 'Glue',
            artist: 'Bicep',
            releaseDate: '2017-09-01',
            popularity: 62,
            done: false,
            addedAt: new Date('2024-01-01T00:00:00.000Z').toISOString()
          }
        ]
      }}
      pinned={false}
      updating={false}
      saveTargetName={null}
      saveError={null}
      needsSaveReconnect={false}
      onBack={jest.fn()}
      onPinToggle={jest.fn()}
      onUpdate={jest.fn()}
      onMarkAllDone={jest.fn()}
      onStartBeatportSearch={jest.fn()}
      onOpenTrackBeatportSearch={onOpenTrackBeatportSearch}
      onReconnectSavedFile={jest.fn()}
      onTrackDoneToggle={jest.fn()}
      t={i18n.t.bind(i18n)}
      i18n={i18n}
      tReady={true}
    />
  )

  fireEvent.click(await screen.findByRole('button', { name: /search this track on beatport/i }))

  expect(onOpenTrackBeatportSearch).toHaveBeenCalledWith('track-1')
})

test('renders tracks by most recently added first', () => {
  i18n.changeLanguage('en')

  render(
    <PlaylistDetail
      playlist={{
        id: 'playlist-1',
        name: 'My Playlist',
        owner: { display_name: 'Carlo' }
      }}
      playlistState={{
        playlistId: 'playlist-1',
        playlistName: 'My Playlist',
        ownerName: 'Carlo',
        updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
        tracks: [
          {
            id: 'track-older',
            uri: 'spotify:track:track-older',
            title: 'Older Track',
            artist: 'Artist One',
            releaseDate: '2017-09-01',
            popularity: 62,
            done: false,
            addedAt: '2024-01-01T00:00:00.000Z'
          },
          {
            id: 'track-newer',
            uri: 'spotify:track:track-newer',
            title: 'Newer Track',
            artist: 'Artist Two',
            releaseDate: '2018-09-01',
            popularity: 70,
            done: false,
            addedAt: '2024-02-01T00:00:00.000Z'
          }
        ]
      }}
      pinned={false}
      updating={false}
      saveTargetName={null}
      saveError={null}
      needsSaveReconnect={false}
      onBack={jest.fn()}
      onPinToggle={jest.fn()}
      onUpdate={jest.fn()}
      onMarkAllDone={jest.fn()}
      onStartBeatportSearch={jest.fn()}
      onOpenTrackBeatportSearch={jest.fn()}
      onReconnectSavedFile={jest.fn()}
      onTrackDoneToggle={jest.fn()}
      t={i18n.t.bind(i18n)}
      i18n={i18n}
      tReady={true}
    />
  )

  const rows = within(screen.getByRole('table')).getAllByRole('row')

  expect(rows[1]).toHaveTextContent('Newer Track')
  expect(rows[2]).toHaveTextContent('Older Track')
})
