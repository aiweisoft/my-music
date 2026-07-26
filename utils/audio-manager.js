const STORAGE_KEY = 'music_playlists'
const STORAGE_ACTIVE_KEY = 'music_active_playlist'

class AudioManager {
	constructor() {
		this.playlists = []
		this.activeIndex = 0
		this.isPlaying = false
		this.currentTime = 0
		this.duration = 0
		this.buffered = 0
		this.playMode = 0
		this._ctx = null
		this._listeners = {}

		this._loadFromStorage()
	}

	get activePlaylist() {
		return this.playlists[this.activeIndex]
	}

	get playlist() {
		const ap = this.activePlaylist
		return ap ? ap.songs : []
	}

	get currentIndex() {
		const ap = this.activePlaylist
		return ap ? ap.currentIndex : -1
	}

	set currentIndex(v) {
		const ap = this.activePlaylist
		if (ap) ap.currentIndex = v
	}

	set playlist(v) {
		const ap = this.activePlaylist
		if (ap) ap.songs = v
	}

	_loadFromStorage() {
		try {
			const data = uni.getStorageSync(STORAGE_KEY)
			if (data && Array.isArray(data)) {
				this.playlists = data
				for (const pl of this.playlists) {
					if (pl.songs) {
						pl.songs = pl.songs.filter(s => !s.id || !String(s.id).startsWith('demo_'))
					}
				}
			}
			if (this.playlists.length === 0) {
				this.playlists.push(this._createBlank('默认歌单'))
			}
			const active = uni.getStorageSync(STORAGE_ACTIVE_KEY)
			if (active !== '' && active !== null && active !== undefined && active >= 0 && active < this.playlists.length) {
				this.activeIndex = parseInt(active)
			}
		} catch (e) {
			this.playlists = [this._createBlank('默认歌单')]
		}
	}

	_saveToStorage() {
		try {
			uni.setStorageSync(STORAGE_KEY, this.playlists)
			uni.setStorageSync(STORAGE_ACTIVE_KEY, this.activeIndex)
		} catch (e) {}
	}

	_createBlank(name) {
		return { id: Date.now().toString(), name, songs: [], currentIndex: -1 }
	}

	// ===== 歌单管理 =====

	createPlaylist(name) {
		const pl = this._createBlank(name || '新歌单')
		this.playlists.push(pl)
		this._saveToStorage()
		this._emit('playlistChange')
		return this.playlists.length - 1
	}

	renamePlaylist(index, name) {
		if (index < 0 || index >= this.playlists.length || !name) return
		this.playlists[index].name = name
		this._saveToStorage()
		this._emit('playlistChange')
	}

	deletePlaylist(index) {
		if (index < 0 || index >= this.playlists.length) return false
		if (this.playlists.length <= 1) return false
		const wasActive = this.activeIndex === index
		this.playlists.splice(index, 1)
		if (wasActive) {
			this.stop()
			this.activeIndex = Math.min(index, this.playlists.length - 1)
		} else if (this.activeIndex > index) {
			this.activeIndex--
		}
		this._saveToStorage()
		this._emit('playlistChange')
		return true
	}

	setActivePlaylist(index) {
		if (index < 0 || index >= this.playlists.length) return
		if (this.activeIndex !== index) {
			this.stop()
			this.activeIndex = index
			this._saveToStorage()
			this._emit('playlistChange')
			this._emit('trackChange')
		}
	}

	// ===== 歌曲管理 =====

	addSongs(files) {
		const list = this.playlist
		const newSongs = files.filter(f => {
			return !list.some(s => s.path === f.path)
		}).map((f, i) => ({
			id: Date.now() + i,
			path: f.path,
			title: f.title || this._extractTitle(f),
			artist: f.artist || '未知艺术家',
			album: f.album || '',
			duration: f.duration || 0,
			size: f.size || 0
		}))

		if (newSongs.length > 0) {
			const ap = this.activePlaylist
			ap.songs.push(...newSongs)
			if (ap.currentIndex === -1) {
				ap.currentIndex = 0
			}
			this._saveToStorage()
			this._emit('playlistChange')
		}
		return newSongs.length
	}

	removeSong(index) {
		const ap = this.activePlaylist
		if (!ap || index < 0 || index >= ap.songs.length) return false
		const wasCurrent = ap.currentIndex === index
		ap.songs.splice(index, 1)

		if (ap.songs.length === 0) {
			ap.currentIndex = -1
			this.stop()
		} else if (wasCurrent) {
			this.stop()
			ap.currentIndex = Math.min(index, ap.songs.length - 1)
		} else if (ap.currentIndex > index) {
			ap.currentIndex--
		}

		this._saveToStorage()
		this._emit('playlistChange')
		return true
	}

	clearCurrent() {
		const ap = this.activePlaylist
		if (!ap) return
		ap.songs = []
		ap.currentIndex = -1
		this.stop()
		this._saveToStorage()
		this._emit('playlistChange')
	}

	// ===== 播放控制 =====

	_createContext() {
		if (this._ctx) {
			this._ctx.destroy()
			this._ctx = null
		}
		this._ctx = uni.createInnerAudioContext()
		this._ctx.autoplay = false
		try {
			const v = uni.getStorageSync('music_volume')
			if (v !== '' && v !== null && v !== undefined) {
				this._ctx.volume = Math.max(0, Math.min(1, parseFloat(v) || 1))
			}
		} catch (e) {}

		this._ctx.onCanplay(() => {
			this.duration = this._ctx.duration || 0
			this._emit('ready')
		})
		this._ctx.onPlay(() => {
			this.isPlaying = true
			this._emit('stateChange')
		})
		this._ctx.onPause(() => {
			this.isPlaying = false
			this._emit('stateChange')
		})
		this._ctx.onStop(() => {
			this.isPlaying = false
			this.currentTime = 0
			this._emit('stateChange')
		})
		this._ctx.onEnded(() => {
			this._next()
		})
		this._ctx.onError((err) => {
			console.error('音频播放错误:', err)
			this.isPlaying = false
			this._emit('error', err)
		})
		this._ctx.onTimeUpdate(() => {
			if (this._ctx) {
				this.currentTime = this._ctx.currentTime || 0
				this.duration = this._ctx.duration || 0
				this.buffered = this._ctx.buffered || 0
			}
		})
		this._ctx.onSeeked(() => {
			this._emit('seeked')
		})
	}

	play(index) {
		const ap = this.activePlaylist
		if (!ap) return
		if (index !== undefined && index >= 0 && index < ap.songs.length) {
			ap.currentIndex = index
		}
		if (ap.currentIndex < 0 || ap.songs.length === 0) return

		const song = ap.songs[ap.currentIndex]
		this._createContext()
		this._ctx.src = song.path
		this._ctx.play()
		this._saveToStorage()
		this._emit('trackChange')
	}

	pause() {
		if (this._ctx) this._ctx.pause()
	}

	toggle() {
		if (this.isPlaying) {
			this.pause()
		} else if (this._ctx) {
			this._ctx.play()
		} else {
			this.play()
		}
	}

	stop() {
		if (this._ctx) this._ctx.stop()
	}

	_next() {
		const ap = this.activePlaylist
		if (!ap || ap.songs.length === 0) return

		switch (this.playMode) {
			case 1:
				break
			case 2:
				ap.currentIndex = Math.floor(Math.random() * ap.songs.length)
				break
			default:
				ap.currentIndex = (ap.currentIndex + 1) % ap.songs.length
				break
		}
		this.play()
	}

	next() {
		const ap = this.activePlaylist
		if (!ap || ap.songs.length === 0) return
		switch (this.playMode) {
			case 1: break
			case 2:
				ap.currentIndex = Math.floor(Math.random() * ap.songs.length)
				break
			default:
				ap.currentIndex = (ap.currentIndex + 1) % ap.songs.length
				break
		}
		this.play()
	}

	prev() {
		const ap = this.activePlaylist
		if (!ap || ap.songs.length === 0) return
		if (this.currentTime > 3) {
			this.seek(0)
			return
		}
		ap.currentIndex = (ap.currentIndex - 1 + ap.songs.length) % ap.songs.length
		this.play()
	}

	seek(value) {
		if (this._ctx && this.duration > 0) {
			this._ctx.seek(value)
			this.currentTime = value
		}
	}

	switchPlayMode() {
		this.playMode = (this.playMode + 1) % 3
		this._emit('modeChange')
	}

	getCurrentSong() {
		const ap = this.activePlaylist
		if (!ap || ap.currentIndex < 0 || ap.currentIndex >= ap.songs.length) return null
		return ap.songs[ap.currentIndex]
	}

	getProgress() {
		if (!this.duration || this.duration <= 0) return 0
		return Math.min((this.currentTime / this.duration) * 100, 100)
	}

	_extractTitle(file) {
		if (file.name) {
			const dot = file.name.lastIndexOf('.')
			return dot > 0 ? file.name.substring(0, dot) : file.name
		}
		const parts = (file.path || '').split('/')
		const name = parts[parts.length - 1] || ''
		const dot = name.lastIndexOf('.')
		return dot > 0 ? name.substring(0, dot) : name
	}

	on(event, callback) {
		if (!this._listeners[event]) this._listeners[event] = []
		this._listeners[event].push(callback)
	}

	off(event, callback) {
		if (!this._listeners[event]) return
		const idx = this._listeners[event].indexOf(callback)
		if (idx > -1) this._listeners[event].splice(idx, 1)
	}

	_emit(event, data) {
		const cbs = this._listeners[event]
		if (cbs) {
			cbs.forEach(cb => {
				try { cb(data) } catch (e) {}
			})
		}
	}

	destroy() {
		if (this._ctx) {
			this._ctx.destroy()
			this._ctx = null
		}
		this._listeners = {}
	}
}

export default new AudioManager()
