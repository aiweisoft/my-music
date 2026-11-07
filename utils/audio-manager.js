import { ensureLocalCopy, localFileExists, isManagedCopy, deleteManagedCopy } from './content-uri.js'

const STORAGE_KEY = 'music_playlists'
const STORAGE_ACTIVE_KEY = 'music_active_playlist'
const STORAGE_MODE_KEY = 'music_play_mode'

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
		this._repairedIds = {}

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
			const mode = parseInt(uni.getStorageSync(STORAGE_MODE_KEY))
			if (mode === 1 || mode === 2) {
				this.playMode = mode
			}
		} catch (e) {
			this.playlists = [this._createBlank('默认歌单')]
		}
	}

	_saveToStorage() {
		try {
			uni.setStorageSync(STORAGE_KEY, this.playlists)
			uni.setStorageSync(STORAGE_ACTIVE_KEY, this.activeIndex)
			uni.setStorageSync(STORAGE_MODE_KEY, this.playMode)
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
		return this.addSongsAt(this.activeIndex, files)
	}

	addSongsAt(index, files) {
		const pl = this.playlists[index]
		if (!pl || !files || files.length === 0) return 0

		const newSongs = files.filter(f => {
			return !pl.songs.some(s => s.path === f.path || (f.uri && s.uri === f.uri))
		}).map((f, i) => ({
			id: Date.now() + i,
			path: f.path,
			uri: f.uri || '',
			title: f.title || this._extractTitle(f),
			artist: f.artist || '未知艺术家',
			album: f.album || '',
			duration: f.duration || 0,
			size: f.size || 0
		}))

		if (newSongs.length > 0) {
			pl.songs.push(...newSongs)
			if (pl.currentIndex === -1) {
				pl.currentIndex = 0
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
		const removed = ap.songs.splice(index, 1)[0]

		if (ap.songs.length === 0) {
			ap.currentIndex = -1
			this.stop()
		} else if (wasCurrent) {
			this.stop()
			ap.currentIndex = Math.min(index, ap.songs.length - 1)
		} else if (ap.currentIndex > index) {
			ap.currentIndex--
		}

		this._releaseSongFile(removed)
		this._saveToStorage()
		this._emit('playlistChange')
		return true
	}

	removeSongAt(playlistIndex, songIndex) {
		if (playlistIndex === this.activeIndex) {
			return this.removeSong(songIndex)
		}
		const pl = this.playlists[playlistIndex]
		if (!pl || songIndex < 0 || songIndex >= pl.songs.length) return false

		const removed = pl.songs.splice(songIndex, 1)[0]
		if (pl.songs.length === 0) {
			pl.currentIndex = -1
		} else if (pl.currentIndex > songIndex) {
			pl.currentIndex--
		}

		this._releaseSongFile(removed)
		this._saveToStorage()
		this._emit('playlistChange')
		return true
	}

	clearCurrent() {
		const ap = this.activePlaylist
		if (!ap) return
		const removed = ap.songs
		ap.songs = []
		ap.currentIndex = -1
		this.stop()
		removed.forEach(song => this._releaseSongFile(song))
		this._saveToStorage()
		this._emit('playlistChange')
	}

	clearPlaylistAt(index) {
		if (index === this.activeIndex) {
			this.clearCurrent()
			return
		}
		const pl = this.playlists[index]
		if (!pl) return
		const removed = pl.songs
		pl.songs = []
		pl.currentIndex = -1
		removed.forEach(song => this._releaseSongFile(song))
		this._saveToStorage()
		this._emit('playlistChange')
	}

	/**
	 * 删除歌曲时顺带清理复制出来的副本文件（其它歌单还在引用则保留）
	 */
	_releaseSongFile(song) {
		if (!song || !song.path) return
		// #ifdef APP-PLUS
		const stillUsed = this.playlists.some(pl => pl.songs.some(s => s !== song && s.path === song.path))
		if (stillUsed) return
		deleteManagedCopy(song.path)
		// #endif
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
			// playback 模式：App 切到后台仍然继续播放
			this._ctx.sessionCategory = 'playback'
		} catch (e) {}
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
			this._consecutiveErrors = 0
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
			this._next(true)
		})
		this._ctx.onError((err) => {
			const curSong = this.getCurrentSong()
			console.error('音频播放错误:', JSON.stringify(err),
				'uri:', curSong ? curSong.uri : 'unknown',
				'path:', curSong ? curSong.path : 'unknown')
			this.isPlaying = false
			this._emit('error', err)

			// 副本损坏/不完整时，删掉重新复制一次再试（每首歌每次运行只尝试一次）
			// #ifdef APP-PLUS
			if (curSong && curSong.uri && !this._repairedIds[curSong.id]) {
				this._repairedIds[curSong.id] = true
				if (isManagedCopy(curSong.path)) {
					deleteManagedCopy(curSong.path)
				}
				const copy = ensureLocalCopy(curSong.uri)
				if (copy) {
					curSong.path = copy
					this._saveToStorage()
					this.play()
					return
				}
			}
			// #endif

			const ap = this.activePlaylist
			if (!ap || ap.songs.length <= 1) return
			if (this.playMode === 1) return

			this._consecutiveErrors = (this._consecutiveErrors || 0) + 1
			if (this._consecutiveErrors >= ap.songs.length) {
				this._consecutiveErrors = 0
				uni.showToast({ title: '播放失败，请检查音频文件', icon: 'none', duration: 2000 })
				return
			}

			setTimeout(() => {
				this._next()
			}, 300)
		})
		this._ctx.onTimeUpdate(() => {
			if (this._ctx) {
				this.currentTime = this._ctx.currentTime || 0
				this.duration = this._ctx.duration || 0
				this.buffered = this._ctx.buffered || 0
				this._emit('timeUpdate')
			}
		})
		this._ctx.onSeeked(() => {
			this._emit('seeked')
		})
	}

	play(index) {
		const ap = this.activePlaylist
		if (!ap) return
		const explicit = index !== undefined && index >= 0 && index < ap.songs.length
		if (explicit) {
			ap.currentIndex = index
			this._consecutiveErrors = 0
		}
		if (ap.currentIndex < 0 || ap.songs.length === 0) return

		const song = ap.songs[ap.currentIndex]
		const path = this._ensurePlayable(song)

		if (!path) {
			// 文件彻底找不到：标记失效并跳过，避免无限重试导致反复弹提示
			song.broken = true
			if (explicit) {
				this._emit('playlistChange')
				uni.showToast({ title: '该歌曲文件已失效，请重新导入', icon: 'none' })
				return
			}
			this._consecutiveErrors = (this._consecutiveErrors || 0) + 1
			if (this._consecutiveErrors >= ap.songs.length) {
				this._consecutiveErrors = 0
				this.isPlaying = false
				this.currentTime = 0
				this._emit('stateChange')
				this._emit('playlistChange')
				uni.showToast({ title: '歌曲文件已失效，请清空后重新导入', icon: 'none', duration: 2500 })
				return
			}
			this._next()
			return
		}

		if (path !== song.path) {
			song.path = path
			this._saveToStorage()
		}
		if (song.broken) {
			song.broken = false
			this._emit('playlistChange')
		}

		this._createContext()
		this._ctx.src = path
		this._ctx.play()
		this._saveToStorage()
		this._emit('trackChange')
	}

	/**
	 * 取当前歌曲真正可用的播放路径
	 * 副本存在就直接用；副本丢失但有原始 URI 就重新复制一次
	 */
	_ensurePlayable(song) {
		// #ifdef APP-PLUS
		if (!song) return null
		if (song.path && song.path.indexOf('content://') !== 0 && localFileExists(song.path)) {
			return song.path
		}
		if (song.uri) {
			const copy = ensureLocalCopy(song.uri)
			if (copy) {
				console.log('[play] 已从原始 URI 恢复文件:', song.uri, '→', copy)
				return copy
			}
		}
		console.warn('[play] 无法获取可播放路径:', song.uri || song.path)
		return null
		// #endif
		return song ? song.path : null
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

	/**
	 * @param {boolean} auto 是否为「自然播放结束」触发
	 * 单曲循环：自动结束时重播当前曲，手动点下一曲仍然切歌
	 */
	_next(auto) {
		const ap = this.activePlaylist
		if (!ap || ap.songs.length === 0) return

		if (this.playMode === 1) {
			if (!auto) {
				ap.currentIndex = (ap.currentIndex + 1) % ap.songs.length
			}
		} else if (this.playMode === 2) {
			ap.currentIndex = Math.floor(Math.random() * ap.songs.length)
		} else {
			ap.currentIndex = (ap.currentIndex + 1) % ap.songs.length
		}
		this.play()
	}

	next() {
		this._next(false)
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
		this._saveToStorage()
		this._emit('modeChange')
	}

	/**
	 * 释放播放器资源（停止播放并销毁音频上下文）
	 */
	release() {
		this.stop()
		if (this._ctx) {
			this._ctx.destroy()
			this._ctx = null
		}
		this.isPlaying = false
		this.currentTime = 0
		this.duration = 0
		this.buffered = 0
		this._emit('stateChange')
	}

	getCurrentSong() {
		const ap = this.activePlaylist
		if (!ap || ap.currentIndex < 0 || ap.currentIndex >= ap.songs.length) return null
		return ap.songs[ap.currentIndex]
	}

	/**
	 * 校验歌单里每首歌的本地文件是否还在，返回失效数量
	 * 只做存在性检查，不触发复制；播放时会自动尝试从原始 URI 恢复
	 */
	validateSongs() {
		// #ifdef APP-PLUS
		let broken = 0
		for (const pl of this.playlists) {
			for (const song of pl.songs) {
				const path = song.path || ''
				const ok = path && path.indexOf('content://') !== 0 && localFileExists(path)
				if (!ok) broken++
				song.broken = !ok
			}
		}
		if (broken > 0) this._emit('playlistChange')
		return broken
		// #endif
		return 0
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
