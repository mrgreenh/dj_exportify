import React from 'react'
import { withTranslation, WithTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface PlaylistRowProps extends WithTranslation {
  playlist: any
  pinned: boolean
  hasCachedTracks: boolean
  onOpen: () => void
  onPinToggle: () => void
}

function PlaylistRow(props: PlaylistRowProps) {
  const { playlist, pinned, hasCachedTracks, i18n } = props

  const renderIcon = () => {
    if (playlist.name === 'Liked') {
      return <FontAwesomeIcon icon={['far', 'heart']} style={{ color: 'red' }} />
    }

    return <FontAwesomeIcon icon={['fas', 'music']} />
  }

  const unsupported = playlist.uri == null

  return (
    <tr>
      <td>{renderIcon()}</td>
      <td>
        {unsupported ? (
          <span>{playlist.name}</span>
        ) : (
          <Button variant="link" className="playlist-link p-0 text-start text-decoration-none" onClick={props.onOpen}>
            {playlist.name}
          </Button>
        )}
      </td>
      <td>{playlist.owner?.display_name}</td>
      <td className="d-none d-sm-table-cell">{playlist.tracks.total}</td>
      <td className="d-none d-md-table-cell">{hasCachedTracks ? i18n.t('playlist.cached', { defaultValue: 'Cached' }) : '—'}</td>
      <td className="text-end">
        <Button
          variant={pinned ? 'warning' : 'outline-secondary'}
          size="sm"
          onClick={props.onPinToggle}
          aria-label={pinned ? i18n.t('playlist.unpin', { defaultValue: 'Unpin' }) : i18n.t('playlist.pin', { defaultValue: 'Pin' })}
        >
          <FontAwesomeIcon icon={['fas', 'thumbtack']} />
        </Button>
      </td>
    </tr>
  )
}

export default withTranslation()(PlaylistRow)
