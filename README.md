[![Build Status](https://api.travis-ci.com/watsonbox/exportify.svg?branch=master)](https://travis-ci.com/github/watsonbox/exportify)

<a href="https://exportify.app/"><img src="assets/screenshot.png"/></a>

Browse your Spotify playlists and manage a lightweight DJ digging workflow by clicking on this link: [https://exportify.app/](https://exportify.app/).

As many users have noted, there is no way to export/archive/backup playlists from the Spotify client for safekeeping. This application provides a simple interface for doing that using the [Spotify Web API](https://developer.spotify.com/documentation/web-api/).

The application runs in the browser, and can optionally persist your pinned playlists and playlist caches to a local JSON file that you choose.

## Features

- 📌 Pin playlists so they stay at the top of the list
- 🔍 Playlist search with [advanced search syntax](#advanced-search-syntax)
- 🎧 Playlist detail view with title, artist, release date, popularity, and per-track done state
- ✅ Mark tracks individually or mark a whole playlist as done
- 💾 Persist pinned playlists and cached playlist data to a local JSON file with autosave
- 🔄 Refresh a playlist on demand and otherwise keep using the cached local copy
- 🔎 Open Beatport searches for every track that is not marked done
- 🌓 Dark mode
- 🗺 Available in 10 languages (English, French, Spanish, Italian, German, Portuguese, Swedish, Dutch, Japanese and Arabic)
- 📱 Mobile friendly
- ℹ Quick reference help
- 🚀 [Advanced rate limiting handling](https://github.com/watsonbox/exportify/pull/75) for speedy playlist refreshes
- 👩‍💻 Modern [React-based development stack](#stack) + test suite

## Usage

1. Fire up [the app](https://exportify.app/)
2. Click 'Get Started'
3. Grant Exportify read-only access to your playlists
4. Optionally click 'Save As' to choose a local JSON file for autosave
5. Pin the playlists you revisit often
6. Click a playlist name to open its detail view
7. Click 'Update' whenever you want to refresh the cached track list from Spotify
8. Use 'Start Beatport Search' to open Beatport tabs for all tracks that are not marked done

Once a save destination has been chosen, playlist pins, cached playlist contents, and done states are automatically written back to that JSON file.

### Playlist Detail View

Opening a playlist shows cached track data with the following fields:

- Track Name
- Artist Name(s)
- Album Release Date
- Popularity
- Done state

The detail view also lets you:

- Refresh the playlist from Spotify on demand
- Mark tracks done one by one or all at once
- Open Beatport searches for tracks that are still pending
- Autosave the resulting state to a JSON file you selected with `Save As`

### Playlist Search

If you're searching for a specific playlist to export, you can use the search facility to find it quickly by name:

<a href="https://watsonbox.github.io/exportify/"><img src="https://user-images.githubusercontent.com/17737/100201109-eb0d7d00-2eff-11eb-993e-7ed955e2361c.gif"/></a>

- Searching is _case-insensitive_.
- Search results stay interactive, so you can pin playlists or open them directly into the detail view

> [!WARNING]
> Please be aware that if you have a very large number of playlists, there may be a small delay before the first search results appear since the Spotify API itself doesn't allow for searching directly, so all playlists must be retrieved first.

#### Advanced Search Syntax

Certain search queries have special meaning:

| Search query | Meaning |
|----|----|
| `public:true` | Only show public playlists |
| `public:false` | Only show private playlists |
| `collaborative:true` | Only show collaborative playlists |
| `collaborative:false` | Don't show collaborative playlists |
| `owner:me` | Only show playlists I own |
| `owner:[owner]` | Only show playlists owned by `[owner]` |


## Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

In the project directory, first run `yarn install` to set up dependencies, then you can run:

**`yarn start`**

Runs the app in the development mode.\
Open [http://127.0.0.1:3000](http://127.0.0.1:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

**`yarn test`**

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

**`yarn build`**

Builds the app for production to the `build` folder.

### Stack

In addition to [Create React App](https://github.com/facebook/create-react-app), the application is built using the following tools/libraries:

* [React](https://reactjs.org/) - A JavaScript library for building user interfaces
* [Bootstrap 5](https://getbootstrap.com/) - styling and UI components
* [Font Awesome 6](https://fontawesome.com/) - vector icon set and toolkit
* [react-i18next](https://react.i18next.com/) - internationalization framework
* [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - light-weight solution for testing React DOM nodes
* [MSW](https://mswjs.io/) - network-level request mocking (more of my own thoughts [here](https://watsonbox.github.io/posts/2020/11/30/discovering-msw.html))

### History

- 2015: Exportify is [born](https://github.com/watsonbox/exportify/commit/b284822e12c3adea8fb83258fdb00ec4690701e1)
- 2020: [Major release](https://watsonbox.github.io/posts/2020/12/02/exportify-refresh.html) including search, artist and audio features, liked songs export, and a new rate limiting system
- 2024: [Major release](https://watsonbox.github.io/posts/2024/09/04/exportify-updates.html) including dark mode, internationalization, and search enhancements

## Notes

- According to Spotify's [documentation](https://developer.spotify.com/web-api/working-with-playlists/):

  > Folders are not returned through the Web API at the moment, nor can be created using it".

  Unfortunately that's just how it is.

- I've [gone to some lengths](https://github.com/watsonbox/exportify/pull/75) to try to eliminate errors resulting from excessively high usage of the Spotify API. Nonetheless, exporting data in bulk is a fairly request-intensive process, so please do try to use this tool responsibly. If you do require more throughput, please consider [creating your own Spotify application](https://github.com/watsonbox/exportify/issues/6#issuecomment-110793132) which you can use with Exportify directly.

- Disclaimer: It should be clear, but this project is not affiliated with Spotify in any way. It's just an app using their API like any other, with a cheeky name and logo 😇.

- In case you don't see the playlists you were expecting to see and realize you've accidentally deleted them, it's actually possible to [recover them](https://support.spotify.com/us/article/can-i-recover-a-deleted-playlist/).


## Error Monitoring

Error monitoring provided by Bugsnag.

<a href="http://www.bugsnag.com">
  <img src="assets/bugsnag.png" width="200" />
</a>

## Running With Docker

To build and run Exportify with docker, run:

**`docker build . -t exportify`**

**`docker run -p 3000:3000 exportify`**

And then open [http://127.0.0.1:3000](http://127.0.0.1:3000) to view it in the browser.

## Contributing

1. Fork it ( https://github.com/watsonbox/exportify/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
