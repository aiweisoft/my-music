<template>
	<view class="player-page">
		<view class="bg-layer">
			<view class="bg-blob bg-blob-1" :class="{ active: isPlaying }"></view>
			<view class="bg-blob bg-blob-2" :class="{ active: isPlaying }"></view>
			<view class="bg-blob bg-blob-3" :class="{ active: isPlaying }"></view>
			<view class="bg-noize"></view>
		</view>

		<view class="top-bar">
			<view class="top-bar-left">
				<text class="app-title">KEYU MUSIC</text>
				<text class="app-tagline">科技羽翼 声动未来</text>
			</view>
			<view class="top-actions">
				<view class="action-btn" @tap="addMusic">
					<text class="action-btn-text">+</text>
				</view>
			</view>
	</view>

	<view v-if="!hasMusic" class="empty-state">
			<view class="empty-notes">
				<text class="empty-note n1">♪</text>
				<text class="empty-note n2">♫</text>
				<text class="empty-note n3">♩</text>
			</view>
			<text class="empty-title">还没有音乐</text>
			<text class="empty-desc">点击右上角 + 添加本地音乐</text>
			<view class="empty-btn" @tap="addMusic">
				<text class="empty-btn-text">添加音乐</text>
			</view>
		</view>

		<view v-else class="player-body">
			<view class="disc-wrapper">
				<view class="disc-glow" :style="{ background: discGradient }"></view>
				<view class="disc-outer" :class="{ spinning: isPlaying }">
					<view class="disc-groove dg1"></view>
					<view class="disc-groove dg2"></view>
					<view class="disc-groove dg3"></view>
					<view class="disc-groove dg4"></view>
					<view class="disc-groove dg5"></view>
					<view class="disc-cover" :style="{ background: discGradient }">
						<view class="disc-glare"></view>
						<view class="disc-label">
							<text class="disc-icon">♫</text>
						</view>
					</view>
				</view>
			</view>

			<view class="song-info">
				<view class="title-scroll" v-if="currentTitle">
					<text class="song-title">{{ currentTitle }}</text>
				</view>
				<text class="song-artist">{{ currentAlbum ? currentArtist + ' · ' + currentAlbum : currentArtist }}</text>
			</view>

			<view class="progress-section">
				<view class="progress-bar">
					<view class="progress-track" @tap="onProgressTap" @touchend="onProgressEnd" @touchmove="onProgressDrag">
						<view class="progress-buffered" :style="{ width: bufferedPercent + '%' }"></view>
						<view class="progress-fill" :style="{ width: progress + '%' }">
							<view class="progress-glow"></view>
						</view>
						<view class="progress-thumb" :style="{ left: progress + '%' }"></view>
					</view>
				</view>
				<view class="time-row">
					<text class="time-text">{{ formatTime(currentTime) }}</text>
					<text class="time-text">{{ formatTime(duration) }}</text>
				</view>
			</view>

			<view class="mode-row">
				<view class="mode-btn" :class="{ active: playMode !== 0 }" @tap="switchMode">
					<view class="mode-icon">
						<block v-if="playMode === 0">
							<view class="mi-loop">
								<view class="mi-arc"></view>
								<view class="mi-arrow"></view>
							</view>
						</block>
						<block v-else-if="playMode === 1">
							<view class="mi-single">
								<view class="mi-arc"></view>
								<text class="mi-num">1</text>
							</view>
						</block>
						<block v-else>
							<view class="mi-shuffle">
								<view class="ms-line ms-l1"></view>
								<view class="ms-line ms-l2"></view>
								<view class="ms-arrow ms-a1"></view>
								<view class="ms-arrow ms-a2"></view>
							</view>
						</block>
					</view>
				</view>
				<view class="list-link" @tap="toPlaylist">
					<text class="list-link-icon">◈</text>
					<text class="list-link-text">{{ playlistName }}</text>
					<text class="list-link-badge">{{ playlistCount }}</text>
				</view>
			</view>



			<view class="controls">
				<view class="ctrl-side" @tap="playPrev">
					<view class="ctrl-prev">
						<view class="cp-bar"></view>
						<view class="cp-tri"></view>
					</view>
				</view>
				<view class="ctrl-main" @tap="playToggle">
					<view class="ctrl-main-ring"></view>
					<view class="ctrl-main-bg">
						<view v-if="isPlaying" class="ctrl-pause">
							<view class="cp-bar1"></view>
							<view class="cp-bar2"></view>
						</view>
						<view v-else class="ctrl-play">
							<view class="cpl-tri"></view>
						</view>
					</view>
				</view>
				<view class="ctrl-side" @tap="playNext">
					<view class="ctrl-next">
						<view class="cn-tri"></view>
						<view class="cn-bar"></view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import audioManager from '../../utils/audio-manager.js'
	import { pickAudioFiles } from '../../utils/file-picker.js'

	export default {
		data() {
			return {
				isPlaying: false,
				currentTitle: '',
				currentArtist: '',
				currentAlbum: '',
				currentTime: 0,
				duration: 0,
				progress: 0,
				bufferedPercent: 0,
				buffered: 0,
				playMode: 0,
				hasMusic: false,
				playlistCount: 0,
				playlistName: '默认歌单',
				discGradient: 'linear-gradient(135deg, #5e6ad2, #828fff)',
				_dragPercent: undefined,
				_timeUpdater: null
			}
		},
		onLoad() {
			this._init()
		},
		onShow() {
			this._refreshState()
		},
		onUnload() {
			this._removeListeners()
			if (this._timeUpdater) clearInterval(this._timeUpdater)
		},
		methods: {
			_init() {
				this._refreshState()
				audioManager.on('stateChange', this._onStateChange)
				audioManager.on('playlistChange', this._onPlaylistChange)
				audioManager.on('trackChange', this._onTrackChange)
				audioManager.on('ready', this._onReady)

				this._timeUpdater = setInterval(() => {
					if (audioManager._ctx && audioManager.isPlaying) {
						this.currentTime = audioManager.currentTime
						this.duration = audioManager.duration
						this.buffered = audioManager.buffered
						this.progress = audioManager.getProgress()
						this.bufferedPercent = this.duration > 0 ? (this.buffered / this.duration * 100) : 0
					}
				}, 250)
			},

			_removeListeners() {
				audioManager.off('stateChange', this._onStateChange)
				audioManager.off('playlistChange', this._onPlaylistChange)
				audioManager.off('trackChange', this._onTrackChange)
				audioManager.off('ready', this._onReady)
			},

			_onStateChange() {
				this.isPlaying = audioManager.isPlaying
			},

			_onPlaylistChange() {
				this._refreshState()
			},

			_onTrackChange() {
				this._updateSongInfo()
			},

			_onReady() {
				this.duration = audioManager.duration
			},

			_refreshState() {
				const ap = audioManager.activePlaylist
				this.hasMusic = ap && ap.songs.length > 0
				this.playlistCount = ap ? ap.songs.length : 0
				this.playlistName = ap ? ap.name : '默认歌单'
				this.isPlaying = audioManager.isPlaying
				this.playMode = audioManager.playMode
				this.currentTime = audioManager.currentTime
				this.duration = audioManager.duration
				this.progress = audioManager.getProgress()
				const song = audioManager.getCurrentSong()
				if (song) {
					this.currentTitle = song.title
					this.currentArtist = song.artist
					this.currentAlbum = song.album || ''
				} else {
					this.currentTitle = ''
					this.currentArtist = ''
					this.currentAlbum = ''
					this.progress = 0
					this.currentTime = 0
					this.duration = 0
				}
				this._updateDiscGradient()
			},

			_updateSongInfo() {
				const song = audioManager.getCurrentSong()
				if (song) {
					this.currentTitle = song.title
					this.currentArtist = song.artist
					this.currentAlbum = song.album || ''
				}
				this.isPlaying = audioManager.isPlaying
				this._updateDiscGradient()
			},

			_updateDiscGradient() {
				const gradients = [
					'linear-gradient(135deg, #5e6ad2 0%, #828fff 100%)',
					'linear-gradient(135deg, #5e6ad2 0%, #7a7fad 100%)',
					'linear-gradient(135deg, #5e69d1 0%, #5e6ad2 100%)',
					'linear-gradient(135deg, #5e6ad2 0%, #6b74d4 100%)',
					'linear-gradient(135deg, #5e69d1 0%, #828fff 100%)',
					'linear-gradient(135deg, #5e6ad2 0%, #5e69d1 100%)',
					'linear-gradient(135deg, #7a7fad 0%, #5e6ad2 100%)',
					'linear-gradient(135deg, #5e6ad2 0%, #8a90d0 100%)'
				]
				const idx = audioManager.currentIndex
				this.discGradient = gradients[idx % gradients.length]
			},

			addMusic() {
				pickAudioFiles((files) => {
					if (files.length > 0) {
						const added = audioManager.addSongs(files)
						if (added > 0) {
							uni.showToast({ title: '已添加 ' + added + ' 首', icon: 'none' })
						} else {
							uni.showToast({ title: '歌曲已在列表中', icon: 'none' })
						}
					}
				}, (err) => {
					console.error('选择文件失败:', err)
				})
			},

			playToggle() {
				if (!this.hasMusic) {
					this.addMusic()
					return
				}
				audioManager.toggle()
			},

			playPrev() {
				audioManager.prev()
			},

			playNext() {
				audioManager.next()
			},

			switchMode() {
				audioManager.switchPlayMode()
				this.playMode = audioManager.playMode
				const modes = ['列表循环', '单曲循环', '随机播放']
				uni.showToast({ title: modes[this.playMode], icon: 'none', duration: 1000 })
			},

			onProgressTap(e) {
				const query = uni.createSelectorQuery().in(this)
				query.select('.progress-track').boundingClientRect(rect => {
					if (rect && rect.width > 0) {
						const x = e.detail.x - rect.left
						const percent = Math.max(0, Math.min(1, x / rect.width))
						this._doSeek(percent)
					}
				}).exec()
			},

			onProgressDrag(e) {
				if (e.touches && e.touches.length > 0) {
					const query = uni.createSelectorQuery().in(this)
					query.select('.progress-track').boundingClientRect(rect => {
						if (rect && rect.width > 0) {
							const x = e.touches[0].clientX - rect.left
							const percent = Math.max(0, Math.min(1, x / rect.width))
							this.progress = percent * 100
							this._dragPercent = percent
						}
					}).exec()
				}
			},

			onProgressEnd(e) {
				if (this._dragPercent !== undefined) {
					this._doSeek(this._dragPercent)
					this._dragPercent = undefined
				}
			},

			_doSeek(percent) {
				const seekTime = audioManager.duration * percent
				audioManager.seek(seekTime)
				this.currentTime = seekTime
				this.progress = percent * 100
			},

			formatTime(seconds) {
				if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00'
				const s = Math.floor(seconds || 0)
				const m = Math.floor(s / 60)
				const sec = s % 60
				return m + ':' + (sec < 10 ? '0' : '') + sec
			},

			toPlaylist() {
				uni.switchTab({ url: '/pages/playlist/playlist' })
			}
		}
	}
</script>

<style>
	.player-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		overflow: hidden;
		background: #010102;
	}

	/* ===== 背景层 ===== */
	.bg-layer {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
	}

	.bg-blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(120rpx);
		opacity: 0.15;
		transition: opacity 1.5s ease, transform 2s ease;
	}

	.bg-blob.active {
		opacity: 0.25;
	}

	.bg-blob-1 {
		width: 500rpx;
		height: 500rpx;
		background: #5e6ad2;
		top: -10%;
		left: -15%;
		animation: blobFloat1 12s ease-in-out infinite;
	}

	.bg-blob-2 {
		width: 400rpx;
		height: 400rpx;
		background: #5e6ad2;
		bottom: -5%;
		right: -10%;
		animation: blobFloat2 14s ease-in-out infinite;
		opacity: 0.08;
	}

	.bg-blob-3 {
		width: 350rpx;
		height: 350rpx;
		background: #5e6ad2;
		top: 50%;
		left: 45%;
		animation: blobFloat3 10s ease-in-out infinite;
		opacity: 0.06;
	}

	.bg-noize {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(94,106,210,0.04) 1rpx, transparent 1rpx);
		background-size: 40rpx 40rpx;
		opacity: 0.5;
	}

	@keyframes blobFloat1 {
		0%,100% { transform: translate(0,0) scale(1); }
		33% { transform: translate(60rpx,30rpx) scale(1.1); }
		66% { transform: translate(-20rpx,-20rpx) scale(0.95); }
	}

	@keyframes blobFloat2 {
		0%,100% { transform: translate(0,0) scale(1); }
		33% { transform: translate(-40rpx,-20rpx) scale(1.08); }
		66% { transform: translate(25rpx,25rpx) scale(0.92); }
	}

	@keyframes blobFloat3 {
		0%,100% { transform: translate(0,0) scale(1); }
		50% { transform: translate(-30rpx,20rpx) scale(1.15); }
	}

	/* ===== 顶部栏 ===== */
	.top-bar {
		width: 100%;
		padding: 100rpx 40rpx 20rpx;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		position: relative;
		z-index: 10;
		box-sizing: border-box;
	}

	.top-bar-left {
		display: flex;
		flex-direction: column;
	}

	.app-title {
		font-size: 44rpx;
		font-weight: 800;
		color: #f7f8f8;
		letter-spacing: -1rpx;
		line-height: 1.2;
	}

	.app-tagline {
		font-size: 24rpx;
		font-weight: 400;
		color: #8a8f98;
		letter-spacing: 1rpx;
		margin-top: 6rpx;
	}

	.action-btn {
		width: 68rpx;
		height: 68rpx;
		border-radius: 8px;
		background: #0f1011;
		border: 1rpx solid #23252a;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.action-btn-text {
		font-size: 42rpx;
		color: #d0d6e0;
		font-weight: 300;
		line-height: 1;
	}

	.action-btn:active {
		transform: scale(0.9);
		background: #141516;
	}

	/* ===== 空状态 ===== */
	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 5;
		padding-bottom: 100rpx;
	}

	.empty-notes {
		position: relative;
		width: 160rpx;
		height: 160rpx;
		margin-bottom: 48rpx;
	}

	.empty-note {
		position: absolute;
		font-size: 64rpx;
		color: rgba(94,106,210,0.08);
	}

	.n1 { top: 0; left: 50%; transform: translateX(-50%); animation: noteFloat 3s ease-in-out infinite; }
	.n2 { top: 50%; left: 0; transform: translateY(-50%); animation: noteFloat 3s ease-in-out 0.6s infinite; }
	.n3 { bottom: 0; right: 10%; animation: noteFloat 3s ease-in-out 1.2s infinite; }

	@keyframes noteFloat {
		0%,100% { opacity: 0.15; transform: translateY(0) rotate(0deg); }
		50% { opacity: 0.4; transform: translateY(-16rpx) rotate(8deg); }
	}

	.empty-title {
		font-size: 38rpx;
		font-weight: 700;
		color: #d0d6e0;
		margin-bottom: 14rpx;
	}

	.empty-desc {
		font-size: 26rpx;
		color: #8a8f98;
		margin-bottom: 64rpx;
	}

	.empty-btn {
		padding: 20rpx 72rpx;
		border-radius: 8px;
		background: #5e6ad2;
		transition: all 0.2s ease;
	}

	.empty-btn:active {
		transform: scale(0.95);
		background: #5e69d1;
	}

	.empty-btn-text {
		font-size: 28rpx;
		color: #ffffff;
		font-weight: 500;
	}

	/* ===== 播放器主体 ===== */
	.player-body {
		flex: 1;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10rpx 40rpx;
		position: relative;
		z-index: 5;
		box-sizing: border-box;
	}

	/* ===== 唱片 ===== */
	.disc-wrapper {
		position: relative;
		margin-bottom: 56rpx;
	}

	.disc-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%,-50%);
		width: 440rpx;
		height: 440rpx;
		border-radius: 50%;
		filter: blur(60rpx);
		opacity: 0.3;
		transition: opacity 0.6s ease;
	}

	.disc-outer {
		width: 520rpx;
		height: 520rpx;
		border-radius: 50%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0f1011;
		box-shadow: 0 24rpx 70rpx rgba(0,0,0,0.6);
	}

	.disc-outer.spinning {
		animation: discSpin 8s linear infinite;
	}

	@keyframes discSpin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.disc-groove {
		position: absolute;
		border-radius: 50%;
		border: 1rpx solid rgba(148,148,148,0.03);
	}

	.dg1 { width: 480rpx; height: 480rpx; }
	.dg2 { width: 440rpx; height: 440rpx; }
	.dg3 { width: 400rpx; height: 400rpx; top: 60rpx; left: 60rpx; }
	.dg4 { width: 360rpx; height: 360rpx; top: 80rpx; left: 80rpx; }
	.dg5 { width: 320rpx; height: 320rpx; top: 100rpx; left: 100rpx; }

	.disc-cover {
		width: 460rpx;
		height: 460rpx;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		box-shadow: inset 0 0 80rpx rgba(0,0,0,0.4);
	}

	.disc-glare {
		position: absolute;
		top: -30%;
		left: -30%;
		width: 160%;
		height: 80%;
		background: linear-gradient(
			180deg,
			rgba(212,212,212,0.06) 0%,
			rgba(212,212,212,0.02) 30%,
			transparent 60%
		);
		transform: rotate(-30deg);
	}

	.disc-label {
		width: 150rpx;
		height: 150rpx;
		border-radius: 50%;
		background: #0f1011;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1rpx solid #23252a;
		position: relative;
		z-index: 2;
	}

	.disc-icon {
		font-size: 52rpx;
		color: #8a8f98;
	}

	/* ===== 歌曲信息 ===== */
	.song-info {
		width: 100%;
		text-align: center;
		margin-bottom: 32rpx;
		padding: 0 40rpx;
		box-sizing: border-box;
	}

	.title-scroll {
		overflow: hidden;
	}

	.song-title {
		font-size: 34rpx;
		font-weight: 700;
		color: #f7f8f8;
		display: block;
		margin-bottom: 8rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: -0.5rpx;
	}

	.song-artist {
		font-size: 24rpx;
		color: #8a8f98;
		display: block;
		font-weight: 400;
	}

	/* ===== 进度条 ===== */
	.progress-section {
		width: 100%;
		padding: 0 28rpx;
		margin-bottom: 16rpx;
		box-sizing: border-box;
	}

	.progress-bar {
		padding: 14rpx 0;
	}

	.progress-track {
		height: 8rpx;
		background: #0f1011;
		border-radius: 4rpx;
		position: relative;
		overflow: visible;
	}

	.progress-buffered {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: #23252a;
		border-radius: 4rpx;
	}

	.progress-fill {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: linear-gradient(90deg, #5e6ad2, #828fff);
		border-radius: 4rpx;
		transition: width 0.15s linear;
	}

	.progress-glow {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translate(50%, -50%);
		width: 24rpx;
		height: 24rpx;
		border-radius: 50%;
		background: #828fff;
		filter: blur(10rpx);
		opacity: 0.35;
		animation: glowPulse 1.5s ease-in-out infinite;
	}

	@keyframes glowPulse {
		0%, 100% { opacity: 0.25; transform: translate(50%, -50%) scale(1); }
		50% { opacity: 0.45; transform: translate(50%, -50%) scale(1.2); }
	}

	.progress-thumb {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 24rpx;
		height: 24rpx;
		border-radius: 50%;
		background: #f7f8f8;
		box-shadow: 0 0 1rpx rgba(0,0,0,0.6), 0 2rpx 8rpx rgba(0,0,0,0.3);
		transition: opacity 0.2s ease, transform 0.15s ease;
	}

	.progress-track:active .progress-thumb {
		transform: translate(-50%, -50%) scale(1.25);
	}

	.time-row {
		display: flex;
		justify-content: space-between;
		margin-top: 8rpx;
	}

	.time-text {
		font-size: 22rpx;
		color: #62666d;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.5rpx;
	}

	/* ===== 模式行 ===== */
	.mode-row {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 28rpx;
		margin-bottom: 28rpx;
		box-sizing: border-box;
	}

	.mode-btn {
		width: 64rpx;
		height: 64rpx;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0f1011;
		border: 1rpx solid #23252a;
		transition: all 0.25s ease;
	}

	.mode-btn:active {
		transform: scale(0.9);
	}

	.mode-btn.active {
		background: #141516;
		border-color: #5e6ad2;
	}

	.mode-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* loop */
	.mi-loop {
		position: relative;
		width: 32rpx;
		height: 28rpx;
	}

	.mi-arc {
		width: 24rpx;
		height: 24rpx;
		border: 3rpx solid #8a8f98;
		border-bottom-color: transparent;
		border-radius: 50%;
	}

	.mode-btn.active .mi-arc {
		border-color: #d0d6e0;
		border-bottom-color: transparent;
	}

	.mi-arrow {
		position: absolute;
		right: 0;
		top: 50%;
		width: 0;
		height: 0;
		border-top: 7rpx solid transparent;
		border-bottom: 7rpx solid transparent;
		border-left: 10rpx solid #8a8f98;
	}

	.mode-btn.active .mi-arrow {
		border-left-color: #d0d6e0;
	}

	/* single */
	.mi-single {
		position: relative;
		width: 32rpx;
		height: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mi-num {
		position: absolute;
		font-size: 16rpx;
		font-weight: 700;
		color: #8a8f98;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.mode-btn.active .mi-num {
		color: #d0d6e0;
	}

	/* shuffle */
	.mi-shuffle {
		position: relative;
		width: 32rpx;
		height: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ms-line {
		position: absolute;
		height: 3rpx;
		background: #8a8f98;
		border-radius: 2rpx;
	}

	.mode-btn.active .ms-line {
		background: #d0d6e0;
	}

	.ms-l1 {
		width: 28rpx;
		top: 6rpx;
		left: 2rpx;
	}

	.ms-l2 {
		width: 28rpx;
		bottom: 6rpx;
		right: 2rpx;
	}

	.ms-arrow {
		position: absolute;
		width: 0;
		height: 0;
		border-top: 7rpx solid transparent;
		border-bottom: 7rpx solid transparent;
	}

	.ms-a1 {
		border-left: 10rpx solid #8a8f98;
		top: 0;
		right: 0;
	}

	.ms-a2 {
		border-right: 10rpx solid #8a8f98;
		bottom: 0;
		left: 0;
	}

	.mode-btn.active .ms-a1 {
		border-left-color: #d0d6e0;
	}

	.mode-btn.active .ms-a2 {
		border-right-color: #d0d6e0;
	}

	.list-link {
		display: flex;
		align-items: center;
		gap: 10rpx;
		padding: 14rpx 24rpx;
		background: #0f1011;
		border-radius: 8px;
		border: 1rpx solid #23252a;
		transition: all 0.2s ease;
	}

	.list-link:active {
		background: #141516;
	}

	.list-link-icon {
		font-size: 20rpx;
		color: #8a8f98;
	}

	.list-link-text {
		font-size: 24rpx;
		color: #d0d6e0;
		max-width: 160rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.list-link-badge {
		font-size: 20rpx;
		color: #62666d;
		background: #141516;
		padding: 2rpx 12rpx;
		border-radius: 4px;
	}

	/* ===== 控制按钮 ===== */
	.controls {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 40rpx;
		box-sizing: border-box;
	}

	.ctrl-side {
		width: 80rpx;
		height: 80rpx;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.ctrl-side:active {
		transform: scale(0.88);
		background: #0f1011;
	}

	.ctrl-prev {
		display: flex;
		align-items: center;
		gap: 6rpx;
	}

	.cp-bar {
		width: 4rpx;
		height: 28rpx;
		border-radius: 2rpx;
		background: #d0d6e0;
	}

	.cp-tri {
		width: 0;
		height: 0;
		border-top: 14rpx solid transparent;
		border-bottom: 14rpx solid transparent;
		border-right: 18rpx solid #d0d6e0;
	}

	.ctrl-next {
		display: flex;
		align-items: center;
		gap: 6rpx;
	}

	.cn-bar {
		width: 4rpx;
		height: 28rpx;
		border-radius: 2rpx;
		background: #d0d6e0;
	}

	.cn-tri {
		width: 0;
		height: 0;
		border-top: 14rpx solid transparent;
		border-bottom: 14rpx solid transparent;
		border-left: 18rpx solid #d0d6e0;
	}

	.ctrl-main {
		margin: 0 72rpx;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.15s ease;
	}

	.ctrl-main:active {
		transform: scale(0.92);
	}

	.ctrl-main-ring {
		position: absolute;
		width: 140rpx;
		height: 140rpx;
		border-radius: 50%;
		border: 2rpx solid rgba(94,106,210,0.2);
		animation: ringPulse 2s ease-in-out infinite;
	}

	@keyframes ringPulse {
		0%,100% { transform: scale(1); opacity: 0.3; }
		50% { transform: scale(1.08); opacity: 0.6; }
	}

	.ctrl-main-bg {
		width: 120rpx;
		height: 120rpx;
		border-radius: 8px;
		background: #5e6ad2;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ctrl-play {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cpl-tri {
		width: 0;
		height: 0;
		border-top: 22rpx solid transparent;
		border-bottom: 22rpx solid transparent;
		border-left: 36rpx solid #ffffff;
		margin-left: 8rpx;
	}

	.ctrl-pause {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.cp-bar1,
	.cp-bar2 {
		width: 10rpx;
		height: 40rpx;
		border-radius: 3rpx;
		background: #ffffff;
	}

	.ctrl-main-icon {
		font-size: 40rpx;
		color: #010102;
	}
</style>
