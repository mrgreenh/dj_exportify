import React from 'react'
import { withTranslation, WithTranslation, Translation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import PlaylistDetail from './PlaylistDetail'
import PlaylistsData from './data/PlaylistsData'
import PlaylistSearch from './PlaylistSearch'
import PlaylistRow from './PlaylistRow'
import Paginator from './Paginator'
import TracksBaseData from './data/TracksBaseData'
import { apiCall, apiCallErrorHandler } from 'helpers'
import {
  clearStoredFileHandle,
  clearStoredSaveTargetName,
  emptyPersistedAppState,
  FilePermissionRequiredError,
  loadStoredFileHandle,
  loadStoredSaveTargetName,
  PersistedAppState,
  PersistedPlaylistState,
  PersistedTrackState,
  pickSaveFileHandle,
  readPersistedAppState,
  storeFileHandle,
  storeSaveTargetName,
  writePersistedAppState
} from 'persistence'

interface PlaylistTableProps extends WithTranslation {
  accessToken: string
  config?: any
  onSetSubtitle: (subtitile: React.JSX.Element) => void
}

interface PlaylistTableState {
  initialized: boolean
  currentPage: number
  searchQuery: string
  allPlaylists: any[]
  selectedPlaylistId: string | null
  persistedState: PersistedAppState
  updatingPlaylistId: string | null
  saveTargetName: string | null
  saveError: string | null
}

class PlaylistTable extends React.Component<PlaylistTableProps, PlaylistTableState> {
  PAGE_SIZE = 20

  private userId?: string
  private saveFileHandle: any = null
  private persistQueue: Promise<void> = Promise.resolve()

  private needsSaveReconnect = () => {
    return Boolean(this.state.saveError?.includes('browser needs a click'))
  }

  state: PlaylistTableState = {
    initialized: false,
    currentPage: 1,
    searchQuery: '',
    allPlaylists: [],
    selectedPlaylistId: null,
    persistedState: emptyPersistedAppState(),
    updatingPlaylistId: null,
    saveTargetName: null,
    saveError: null
  }

  async componentDidMount() {
    try {
      await this.restoreSavedState()

      const user = await apiCall('https://api.spotify.com/v1/me', this.props.accessToken)
        .then((response) => response.data)

      this.userId = user.id

      const playlistsData = new PlaylistsData(this.props.accessToken, this.userId!)
      const allPlaylists = await playlistsData.all()

      this.setState(
        {
          initialized: true,
          allPlaylists
        },
        this.refreshSubtitle
      )
    } catch (error) {
      apiCallErrorHandler(error)
    }
  }

  private restoreSavedState = async () => {
    const storedSaveTargetName = loadStoredSaveTargetName()

    try {
      const storedHandle = await loadStoredFileHandle()

      if (!storedHandle) {
        if (storedSaveTargetName) {
          clearStoredSaveTargetName()
        }

        return
      }

      this.saveFileHandle = storedHandle
      const persistedState = await readPersistedAppState(storedHandle, { requestPermission: false })

      this.setState({
        persistedState,
        saveTargetName: storedSaveTargetName || storedHandle.name || null,
        saveError: null
      })
    } catch (error) {
      if (error instanceof FilePermissionRequiredError) {
        this.setState({
          saveTargetName: storedSaveTargetName,
          saveError: error.message
        })
        return
      }

      this.saveFileHandle = null
      await clearStoredFileHandle()
      clearStoredSaveTargetName()

      this.setState({
        saveTargetName: null,
        saveError: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private persistState = async (stateToPersist = this.state.persistedState) => {
    if (!this.saveFileHandle) {
      return
    }

    this.persistQueue = this.persistQueue.then(async () => {
      try {
        await writePersistedAppState(this.saveFileHandle, stateToPersist)

        if (this.state.saveError) {
          this.setState({ saveError: null })
        }
      } catch (error) {
        this.setState({ saveError: error instanceof Error ? error.message : String(error) })
      }
    })

    await this.persistQueue
  }

  private updatePersistedState = (updater: (state: PersistedAppState) => PersistedAppState, callback?: () => void) => {
    this.setState((prevState) => ({
      persistedState: updater(prevState.persistedState),
      saveError: null
    }), async () => {
      await this.persistState(this.state.persistedState)
      callback?.()
    })
  }

  private refreshSubtitle = () => {
    const selectedPlaylist = this.getSelectedPlaylist()

    if (selectedPlaylist) {
      this.props.onSetSubtitle(<>{selectedPlaylist.name}</>)
      return
    }

    const filteredPlaylists = this.getFilteredPlaylists()
    const min = filteredPlaylists.length === 0 ? 0 : ((this.state.currentPage - 1) * this.PAGE_SIZE) + 1
    const max = Math.min(min + this.PAGE_SIZE - 1, filteredPlaylists.length)

    if (this.state.searchQuery.length > 0) {
      let key = 'subtitle_search'

      if (
        this.state.searchQuery.startsWith('public:') ||
        this.state.searchQuery.startsWith('collaborative:') ||
        this.state.searchQuery.startsWith('owner:')
      ) {
        key += '_advanced'
      }

      this.props.onSetSubtitle(
        <Translation>{(t) => t(key, { total: filteredPlaylists.length, query: this.state.searchQuery })}</Translation>
      )

      return
    }

    this.props.onSetSubtitle(
      <Translation>{(t) => t('subtitle', { min, max, total: filteredPlaylists.length, userId: this.userId })}</Translation>
    )
  }

  private isPinned = (playlistId: string) => {
    return this.state.persistedState.pinnedPlaylistIds.includes(playlistId)
  }

  private getPlaylistState = (playlistId: string): PersistedPlaylistState | undefined => {
    return this.state.persistedState.playlistsById[playlistId]
  }

  private getSelectedPlaylist = () => {
    return this.state.selectedPlaylistId == null
      ? null
      : this.state.allPlaylists.find((playlist) => playlist.id === this.state.selectedPlaylistId) || null
  }

  private sortPlaylists = (playlists: any[]) => {
    const pinnedPlaylistIds = new Set(this.state.persistedState.pinnedPlaylistIds)

    return playlists
      .map((playlist, index) => ({ playlist, index }))
      .sort((left, right) => {
        const leftPinned = pinnedPlaylistIds.has(left.playlist.id)
        const rightPinned = pinnedPlaylistIds.has(right.playlist.id)

        if (leftPinned !== rightPinned) {
          return leftPinned ? -1 : 1
        }

        return left.index - right.index
      })
      .map(({ playlist }) => playlist)
  }

  private getFilteredPlaylists = () => {
    const query = this.state.searchQuery.trim()
    const playlists = this.state.allPlaylists

    if (query.length === 0) {
      return this.sortPlaylists(playlists)
    }

    let filteredPlaylists = playlists

    if (query.startsWith('public:')) {
      filteredPlaylists = playlists.filter((playlist) => playlist.public === query.endsWith(':true'))
    } else if (query.startsWith('collaborative:')) {
      filteredPlaylists = playlists.filter((playlist) => playlist.collaborative === query.endsWith(':true'))
    } else if (query.startsWith('owner:')) {
      let ownerId = query.match(/owner:(.*)/)?.at(-1)?.toLowerCase()

      if (ownerId === 'me') {
        ownerId = this.userId
      }

      filteredPlaylists = playlists.filter((playlist) => playlist.owner?.id === ownerId)
    } else {
      filteredPlaylists = playlists.filter((playlist) => playlist.name.toLowerCase().includes(query.toLowerCase()))
    }

    return this.sortPlaylists(filteredPlaylists)
  }

  private getCurrentPagePlaylists = () => {
    const filteredPlaylists = this.getFilteredPlaylists()
    const start = (this.state.currentPage - 1) * this.PAGE_SIZE
    return filteredPlaylists.slice(start, start + this.PAGE_SIZE)
  }

  private handlePlaylistSearch = (query: string) => {
    this.setState(
      {
        searchQuery: query,
        currentPage: 1
      },
      this.refreshSubtitle
    )
  }

  private handlePlaylistSearchCancel = () => {
    return new Promise<void>((resolve) => {
      this.setState(
        {
          searchQuery: '',
          currentPage: 1
        },
        () => {
          this.refreshSubtitle()
          resolve()
        }
      )
    })
  }

  private handlePageChanged = (page: number) => {
    this.setState({ currentPage: page }, this.refreshSubtitle)
  }

  private openPlaylist = (playlistId: string) => {
    this.setState({ selectedPlaylistId: playlistId }, this.refreshSubtitle)
  }

  private closePlaylist = () => {
    this.setState({ selectedPlaylistId: null }, this.refreshSubtitle)
  }

  private togglePinned = (playlistId: string) => {
    this.updatePersistedState((persistedState) => {
      const pinnedPlaylistIds = persistedState.pinnedPlaylistIds.includes(playlistId)
        ? persistedState.pinnedPlaylistIds.filter((id) => id !== playlistId)
        : [playlistId, ...persistedState.pinnedPlaylistIds]

      return {
        ...persistedState,
        pinnedPlaylistIds
      }
    }, this.refreshSubtitle)
  }

  private handleTrackDoneToggle = (playlistId: string, trackId: string, done: boolean) => {
    this.updatePersistedState((persistedState) => {
      const playlistState = persistedState.playlistsById[playlistId]

      if (!playlistState) {
        return persistedState
      }

      return {
        ...persistedState,
        playlistsById: {
          ...persistedState.playlistsById,
          [playlistId]: {
            ...playlistState,
            tracks: playlistState.tracks.map((track) => {
              if (track.id !== trackId) {
                return track
              }

              return {
                ...track,
                done
              }
            })
          }
        }
      }
    })
  }

  private markAllDone = (playlistId: string) => {
    this.updatePersistedState((persistedState) => {
      const playlistState = persistedState.playlistsById[playlistId]

      if (!playlistState) {
        return persistedState
      }

      return {
        ...persistedState,
        playlistsById: {
          ...persistedState.playlistsById,
          [playlistId]: {
            ...playlistState,
            tracks: playlistState.tracks.map((track) => ({
              ...track,
              done: true
            }))
          }
        }
      }
    })
  }

  private startBeatportSearch = (playlistId: string) => {
    const playlistState = this.getPlaylistState(playlistId)

    if (!playlistState) {
      return
    }

    const pendingTracks = playlistState.tracks.filter((track) => !track.done)

    if (pendingTracks.length === 0) {
      return
    }

    if (pendingTracks.length === 1) {
      this.openBeatportSearch(pendingTracks[0])
      return
    }

    const urls = pendingTracks.map((track) => this.buildBeatportSearchUrl(track))

    const launcher = window.open('', 'beatport-batch-launcher')

    if (!launcher) {
      return
    }

    launcher.document.open()
    launcher.document.write(this.buildBeatportLauncherHtml(pendingTracks, urls))
    launcher.document.close()
  }

  private openTrackBeatportSearch = (playlistId: string, trackId: string) => {
    const track = this.getPlaylistState(playlistId)?.tracks.find((playlistTrack) => playlistTrack.id === trackId)

    if (!track) {
      return
    }

    this.openBeatportSearch(track)
  }

  private openBeatportSearch(track: PersistedTrackState) {
    window.open(this.buildBeatportSearchUrl(track), '_blank')
  }

  private buildBeatportSearchUrl(track: PersistedTrackState) {
    return `https://www.beatport.com/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`
  }

  private buildBeatportLauncherHtml(tracks: PersistedTrackState[], urls: string[]) {
    const escapedUrls = JSON.stringify(urls)
    const snippetTracks = JSON.stringify(
      tracks.map((track) => ({
        track: track.title,
        artist: track.artist
      })),
      null,
      2
    )
    const consoleSnippet = `const tracks = ${snippetTracks};\n\ntracks.forEach(track => {\n  const searchQuery = \`${'${track.track}'} ${'${track.artist}'}\`.replace(/\\s+/g, '%20');\n  const url = \`https://www.beatport.com/search?q=\${searchQuery}\`;\n  window.open(url, '_blank');\n});`
    const escapedSnippet = this.escapeHtml(consoleSnippet)
    const escapedTitle = 'Beatport Search Launcher'

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapedTitle}</title>
    <style>
      body { font-family: sans-serif; padding: 24px; line-height: 1.5; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      p { margin: 0 0 12px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      ul { padding-left: 20px; }
      pre { background: #f6f8fa; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
      button { padding: 8px 12px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>${escapedTitle}</h1>
    <h2>Console fallback</h2>
    <p>Open DevTools, paste this in the console, and press Enter.</p>
    <button id="copy-snippet">Copy snippet</button>
    <pre id="console-snippet">${escapedSnippet}</pre>
    <p>Opening ${urls.length} Beatport tabs. If your browser blocks some of them, use the links below.</p>
    <ul id="links"></ul>
    <script>
      (function () {
        var urls = ${escapedUrls};
        var list = document.getElementById('links');
        var copyButton = document.getElementById('copy-snippet');
        var snippet = document.getElementById('console-snippet').textContent;

        urls.forEach(function (url, index) {
          var item = document.createElement('li');
          var link = document.createElement('a');
          link.href = url;
          link.target = 'beatport-search-' + index + '-' + Date.now();
          link.rel = 'noopener noreferrer';
          link.textContent = url;
          item.appendChild(link);
          list.appendChild(item);

          try {
            window.open(url, link.target);
          } catch (error) {}
        });

        copyButton.addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(snippet);
          }
        });
      })();
    </script>
  </body>
</html>`
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  private handleSaveAs = async () => {
    try {
      if (this.saveFileHandle && this.state.saveError?.includes('browser needs a click')) {
        const persistedState = await readPersistedAppState(this.saveFileHandle)

        this.setState({ persistedState, saveError: null }, this.refreshSubtitle)
        return
      }

      const handle = await pickSaveFileHandle()
      this.saveFileHandle = handle

      await storeFileHandle(handle)

      const saveTargetName = handle.name || 'dj-exportify-state.json'
      storeSaveTargetName(saveTargetName)

      this.setState({ saveTargetName, saveError: null })
      await this.persistState(this.state.persistedState)
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return
      }

      this.saveFileHandle = null

      this.setState({ saveError: error instanceof Error ? error.message : String(error) })
    }
  }

  private buildTrackId(item: any, index: number) {
    return `${item.track?.uri || item.track?.id || 'track'}::${item.added_at || ''}::${index}`
  }

  private mapTrackItemsToPersistedTracks(playlistId: string, trackItems: any[]): PersistedTrackState[] {
    const existingPlaylistState = this.getPlaylistState(playlistId)
    const doneByTrackId = new Map(existingPlaylistState?.tracks.map((track) => [track.id, track.done]) || [])
    const doneByUri = new Map(existingPlaylistState?.tracks.map((track) => [track.uri, track.done]) || [])

    return trackItems
      .map((item, index) => {
        if (!item.track) {
          return null
        }

        const id = this.buildTrackId(item, index)
        const uri = item.track.uri || item.track.id || id

        return {
          id,
          uri,
          title: item.track.name || '',
          artist: (item.track.artists || []).map((artist: any) => artist.name).join(', '),
          releaseDate: item.track.album?.release_date || '',
          popularity: item.track.popularity || 0,
          done: doneByTrackId.get(id) ?? doneByUri.get(uri) ?? false,
          addedAt: item.added_at || ''
        }
      })
      .filter(Boolean) as PersistedTrackState[]
  }

  private refreshPlaylistMetadata = async (playlist: any) => {
    if (playlist.id === 'liked') {
      const likedTracksData = await apiCall('https://api.spotify.com/v1/me/tracks', this.props.accessToken)
        .then((response) => response.data)

      return {
        ...playlist,
        tracks: {
          href: 'https://api.spotify.com/v1/me/tracks',
          limit: likedTracksData.limit,
          total: likedTracksData.total
        }
      }
    }

    return apiCall(playlist.href, this.props.accessToken)
      .then((response) => response.data)
  }

  private handlePlaylistUpdate = async (playlist: any) => {
    this.setState({ updatingPlaylistId: playlist.id, saveError: null })

    try {
      const refreshedPlaylist = await this.refreshPlaylistMetadata(playlist)
      const trackItems = await new TracksBaseData(this.props.accessToken, refreshedPlaylist).trackItems()
      const tracks = this.mapTrackItemsToPersistedTracks(refreshedPlaylist.id, trackItems)

      const playlistState: PersistedPlaylistState = {
        playlistId: refreshedPlaylist.id,
        playlistName: refreshedPlaylist.name,
        ownerName: refreshedPlaylist.owner?.display_name || refreshedPlaylist.owner?.id || '',
        snapshotId: refreshedPlaylist.snapshot_id,
        updatedAt: new Date().toISOString(),
        tracks
      }

      this.setState((prevState) => ({
        updatingPlaylistId: null,
        allPlaylists: prevState.allPlaylists.map((currentPlaylist) => currentPlaylist.id === refreshedPlaylist.id ? refreshedPlaylist : currentPlaylist),
        persistedState: {
          ...prevState.persistedState,
          playlistsById: {
            ...prevState.persistedState.playlistsById,
            [refreshedPlaylist.id]: playlistState
          }
        }
      }), async () => {
        await this.persistState(this.state.persistedState)
        this.refreshSubtitle()
      })
    } catch (error) {
      this.setState({ updatingPlaylistId: null })
      apiCallErrorHandler(error)
    }
  }

  render() {
    if (!this.state.initialized) {
      return <div className="spinner" data-testid="playlistTableSpinner"></div>
    }

    const filteredPlaylists = this.getFilteredPlaylists()
    const selectedPlaylist = this.getSelectedPlaylist()

    if (selectedPlaylist) {
      return (
        <PlaylistDetail
          playlist={selectedPlaylist}
          playlistState={this.getPlaylistState(selectedPlaylist.id)}
          pinned={this.isPinned(selectedPlaylist.id)}
          updating={this.state.updatingPlaylistId === selectedPlaylist.id}
          saveTargetName={this.state.saveTargetName}
          saveError={this.state.saveError}
          needsSaveReconnect={this.needsSaveReconnect()}
          onBack={this.closePlaylist}
          onPinToggle={() => this.togglePinned(selectedPlaylist.id)}
          onUpdate={() => this.handlePlaylistUpdate(selectedPlaylist)}
          onMarkAllDone={() => this.markAllDone(selectedPlaylist.id)}
          onStartBeatportSearch={() => this.startBeatportSearch(selectedPlaylist.id)}
          onOpenTrackBeatportSearch={(trackId) => this.openTrackBeatportSearch(selectedPlaylist.id, trackId)}
          onReconnectSavedFile={this.handleSaveAs}
          onTrackDoneToggle={(trackId, done) => this.handleTrackDoneToggle(selectedPlaylist.id, trackId, done)}
        />
      )
    }

    return (
      <div id="playlists">
        <div id="playlistsHeader" className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <Paginator
            currentPage={this.state.currentPage}
            pageLimit={this.PAGE_SIZE}
            totalRecords={filteredPlaylists.length}
            onPageChanged={this.handlePageChanged}
          />
          <PlaylistSearch onPlaylistSearch={this.handlePlaylistSearch} onPlaylistSearchCancel={this.handlePlaylistSearchCancel} />
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <Button variant="outline-secondary" size="sm" onClick={this.handleSaveAs}>
              <FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {this.needsSaveReconnect()
                ? this.props.i18n.t('playlist.reconnect_saved_file', { defaultValue: 'Reconnect saved file' })
                : this.props.i18n.t('playlist.save_as', { defaultValue: 'Save As' })}
            </Button>
            {this.state.saveTargetName && (
              <span className="small text-secondary">{this.state.saveTargetName}</span>
            )}
          </div>
        </div>

        <div className="small text-secondary mt-2 mb-3">
          {this.state.saveTargetName
            ? this.props.i18n.t('playlist.global_autosave_enabled', { defaultValue: 'Global autosave stores every playlist you update in this JSON file.' })
            : this.props.i18n.t('playlist.global_autosave_disabled', { defaultValue: 'Choose Save As once here to autosave all updated playlists globally.' })}
        </div>

        {this.state.saveError && (
          <div className="alert alert-warning py-2 mt-3 d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <span>{this.state.saveError}</span>
            {this.needsSaveReconnect() && (
              <Button variant="outline-secondary" size="sm" onClick={this.handleSaveAs}>
                <FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {this.props.i18n.t('playlist.reconnect_saved_file', { defaultValue: 'Reconnect saved file' })}
              </Button>
            )}
          </div>
        )}

        <div className="table-responsive-sm">
          <table className="table table-hover table-sm">
            <thead>
              <tr>
                <th className="icon"></th>
                <th className="name">{this.props.i18n.t('playlist.name')}</th>
                <th className="owner">{this.props.i18n.t('playlist.owner')}</th>
                <th className="tracks d-none d-sm-table-cell">{this.props.i18n.t('playlist.tracks')}</th>
                <th className="d-none d-md-table-cell">{this.props.i18n.t('playlist.cached_state', { defaultValue: 'Cache' })}</th>
                <th className="text-end">{this.props.i18n.t('playlist.pin', { defaultValue: 'Pin' })}</th>
              </tr>
            </thead>
            <tbody>
              {this.getCurrentPagePlaylists().map((playlist: any) => (
                <PlaylistRow
                  key={playlist.id}
                  playlist={playlist}
                  pinned={this.isPinned(playlist.id)}
                  hasCachedTracks={Boolean(this.getPlaylistState(playlist.id)?.tracks.length)}
                  onOpen={() => this.openPlaylist(playlist.id)}
                  onPinToggle={() => this.togglePinned(playlist.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div id="playlistsFooter">
          <Paginator
            currentPage={this.state.currentPage}
            pageLimit={this.PAGE_SIZE}
            totalRecords={filteredPlaylists.length}
            onPageChanged={this.handlePageChanged}
          />
        </div>
      </div>
    )
  }
}

export default withTranslation()(PlaylistTable)
