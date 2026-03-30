import React from 'react'
import { withTranslation, WithTranslation } from 'react-i18next'
import { Button, Form } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { PersistedPlaylistState } from 'persistence'

interface PlaylistDetailProps extends WithTranslation {
  playlist: any
  playlistState?: PersistedPlaylistState
  pinned: boolean
  updating: boolean
  saveTargetName: string | null
  saveError: string | null
  needsSaveReconnect: boolean
  onBack: () => void
  onPinToggle: () => void
  onUpdate: () => void
  onMarkAllDone: () => void
  onStartBeatportSearch: () => void
  onOpenTrackBeatportSearch: (trackId: string) => void
  onReconnectSavedFile: () => void
  onTrackDoneToggle: (trackId: string, done: boolean) => void
}

export function PlaylistDetail(props: PlaylistDetailProps) {
  const { i18n, playlist, playlistState } = props
  const tracks = [...(playlistState?.tracks || [])].sort((left, right) => {
    const leftAddedAt = Date.parse(left.addedAt || '')
    const rightAddedAt = Date.parse(right.addedAt || '')

    if (Number.isNaN(leftAddedAt) && Number.isNaN(rightAddedAt)) {
      return 0
    }

    if (Number.isNaN(leftAddedAt)) {
      return 1
    }

    if (Number.isNaN(rightAddedAt)) {
      return -1
    }

    return rightAddedAt - leftAddedAt
  })
  const pendingTracks = tracks.filter((track) => !track.done)
  const remainingTracksLabel = pendingTracks.length === 1
    ? '1 track remaining'
    : `${pendingTracks.length} tracks remaining`

  return (
    <div className="playlist-detail">
      <div className="playlist-detail-header d-flex flex-wrap gap-2 justify-content-between align-items-start mb-3">
        <div>
          <Button variant="link" className="ps-0 text-decoration-none" onClick={props.onBack}>
            <FontAwesomeIcon icon={['fas', 'arrow-left']} /> {i18n.t('playlist.back_to_playlists', { defaultValue: 'Back to playlists' })}
          </Button>
          <h2 className="h4 mb-1">{playlist.name}</h2>
          <div className="text-secondary small">
            {playlist.owner?.display_name || playlistState?.ownerName}
            {playlistState?.updatedAt && (
              <span>
                {' · '}
                {i18n.t('playlist.last_updated', { defaultValue: 'Last updated' })}: {new Date(playlistState.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 justify-content-end">
          <Button variant={props.pinned ? 'warning' : 'outline-secondary'} size="sm" onClick={props.onPinToggle}>
            <FontAwesomeIcon icon={['fas', 'thumbtack']} /> {props.pinned ? i18n.t('playlist.unpin', { defaultValue: 'Unpin' }) : i18n.t('playlist.pin', { defaultValue: 'Pin' })}
          </Button>
          <Button variant="outline-primary" size="sm" onClick={props.onUpdate} disabled={props.updating}>
            <FontAwesomeIcon icon={['fas', 'sync']} spin={props.updating} /> {i18n.t('playlist.update', { defaultValue: 'Update' })}
          </Button>
          <Button variant="outline-success" size="sm" onClick={props.onMarkAllDone} disabled={tracks.length === 0}>
            <FontAwesomeIcon icon={['fas', 'check']} /> {i18n.t('playlist.mark_all_done', { defaultValue: 'Mark all as done' })}
          </Button>
          <Button variant="primary" size="sm" onClick={props.onStartBeatportSearch} disabled={pendingTracks.length === 0}>
            <FontAwesomeIcon icon={['fas', 'search']} /> {i18n.t('playlist.start_beatport_search', { defaultValue: 'Start Beatport Search' })}
          </Button>
        </div>
      </div>

      <div className="small text-secondary mb-3">
        {props.saveTargetName
          ? i18n.t('playlist.autosave_enabled', { defaultValue: 'Global autosave enabled:' }) + ' ' + props.saveTargetName
          : i18n.t('playlist.autosave_disabled', { defaultValue: 'Choose a JSON file from the playlists page to enable global autosave.' })}
      </div>

      <div className="small text-secondary mb-3">
        {i18n.t('playlist.remaining_tracks', { defaultValue: remainingTracksLabel })}
      </div>

      {props.saveError && (
        <div className="alert alert-warning py-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <span>{props.saveError}</span>
          {props.needsSaveReconnect && (
            <Button variant="outline-secondary" size="sm" onClick={props.onReconnectSavedFile}>
              <FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {i18n.t('playlist.reconnect_saved_file', { defaultValue: 'Reconnect saved file' })}
            </Button>
          )}
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="alert alert-light border">
          {i18n.t('playlist.no_cached_tracks', { defaultValue: 'No cached tracks yet. Click Update to fetch and cache this playlist.' })}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm align-middle">
            <thead>
              <tr>
                <th>{i18n.t('track.track_name')}</th>
                <th>{i18n.t('track.artist_names')}</th>
                <th>{i18n.t('track.album_release_date')}</th>
                <th>{i18n.t('track.popularity')}</th>
                <th className="text-center">{i18n.t('playlist.search', { defaultValue: 'Search' })}</th>
                <th className="text-center">{i18n.t('playlist.done', { defaultValue: 'Done' })}</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id} className={track.done ? 'track-done' : ''}>
                  <td>{track.title}</td>
                  <td>{track.artist}</td>
                  <td>{track.releaseDate || '—'}</td>
                  <td>{track.popularity}</td>
                  <td className="text-center track-actions-cell">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => props.onOpenTrackBeatportSearch(track.id)}
                      aria-label={i18n.t('playlist.search_track_on_beatport', { defaultValue: 'Search this track on Beatport', track: track.title })}
                    >
                      <FontAwesomeIcon icon={['fas', 'search']} /> {i18n.t('playlist.beatport', { defaultValue: 'Beatport' })}
                    </Button>
                  </td>
                  <td className="text-center">
                    <Form.Check
                      type="checkbox"
                      checked={track.done}
                      aria-label={i18n.t('playlist.mark_track_done', { defaultValue: 'Mark track as done', track: track.title })}
                      onChange={(event) => props.onTrackDoneToggle(track.id, event.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default withTranslation()(PlaylistDetail)
