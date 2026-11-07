<template>
	<view class="playlist-page">
		<view class="bg-layer">
			<view class="bg-grain"></view>
		</view>

		<view class="top-bar">
			<text class="page-title">我的歌单</text>
			<view class="top-actions">
				<text class="action-btn" @tap="clearCache">缓存</text>
				<text class="action-btn" @tap="createPlaylist">+ 新建</text>
			</view>
		</view>

		<scroll-view scroll-x class="tab-scroll" :show-scrollbar="false">
			<view class="tab-list">
				<view
					v-for="(pl, idx) in playlists"
					:key="pl.id"
					class="tab-item"
					:class="{ active: idx === tabIndex, playing: idx === audioIndex }"
					@tap="switchTab(idx)"
					@longpress="editPlaylist(idx)"
				>
					<view class="tab-bar" :class="{ 'bar-active': idx === tabIndex, 'bar-playing': idx === audioIndex }"></view>
					<text class="tab-name">{{ pl.name }}</text>
					<text class="tab-count">{{ pl.songs.length }} 首</text>
				</view>
			</view>
		</scroll-view>

		<view class="playlist-header" v-if="currentPlaylist">
			<text class="pl-header-title">{{ currentPlaylist.name }}</text>
			<view class="pl-header-actions">
				<text class="pl-action" @tap="clearCurrent">清空</text>
				<text class="pl-action pl-action-add" @tap="addToCurrent">+ 添加歌曲</text>
			</view>
		</view>

		<view v-if="!currentPlaylist || currentPlaylist.songs.length === 0" class="empty-state">
			<view class="empty-notes">
				<text class="empty-note n1">♪</text>
				<text class="empty-note n2">♫</text>
			</view>
			<text class="empty-text">歌单为空</text>
			<text class="empty-hint">点击「添加歌曲」导入音乐</text>
		</view>

		<scroll-view v-else class="song-list" scroll-y>
			<view
				v-for="(song, si) in currentPlaylist.songs"
				:key="song.id"
				class="song-item"
				:class="{ active: isActiveSong(tabIndex, si) }"
				@tap="playSong(si)"
				@longpress="removeSong(si)"
			>
				<view class="song-cover" :style="{ background: getCoverGradient(si) }">
					<text v-if="isActiveSong(tabIndex, si) && isPlaying" class="cover-eq">
						<text class="eq-bar e1"></text>
						<text class="eq-bar e2"></text>
						<text class="eq-bar e3"></text>
					</text>
					<text v-else class="cover-num">{{ si + 1 }}</text>
				</view>
				<view class="song-meta">
					<text class="song-name" :class="{ 'playing-text': isActiveSong(tabIndex, si) }">{{ song.title }}</text>
					<text v-if="song.broken" class="song-info-text broken-text">文件已失效，请重新导入</text>
					<text v-else class="song-info-text">{{ song.album ? song.artist + ' · ' + song.album : song.artist }}</text>
				</view>
				<view class="song-status">
					<text v-if="isActiveSong(tabIndex, si) && isPlaying" class="playing-indicator"></text>
				</view>
			</view>
			<view class="list-footer">
				<text class="footer-text">长按删除歌曲 · 长按歌单编辑</text>
			</view>
		</scroll-view>
	</view>
</template>

<script>
	import audioManager from '../../utils/audio-manager.js'
	import { pickAudioFiles } from '../../utils/file-picker.js'

	export default {
		data() {
			return {
				playlists: [],
				tabIndex: 0,
				audioIndex: 0,
				isPlaying: false
			}
		},
		computed: {
			currentPlaylist() {
				return this.playlists[this.tabIndex] || null
			}
		},
		onShow() {
			audioManager.validateSongs()
			this._refresh()
		},
		onLoad() {
			audioManager.on('playlistChange', this._refresh)
			audioManager.on('stateChange', this._onState)
			audioManager.on('trackChange', this._refresh)
		},
		onUnload() {
			audioManager.off('playlistChange', this._refresh)
			audioManager.off('stateChange', this._onState)
			audioManager.off('trackChange', this._refresh)
		},
		methods: {
			_refresh() {
				this.playlists = audioManager.playlists.map(p => ({
					id: p.id,
					name: p.name,
					songs: [...p.songs],
					currentIndex: p.currentIndex
				}))
				this.audioIndex = audioManager.activeIndex
				if (this.tabIndex >= this.playlists.length) {
					this.tabIndex = Math.max(0, this.playlists.length - 1)
				}
				this.isPlaying = audioManager.isPlaying
			},

			_onState() {
				this.isPlaying = audioManager.isPlaying
			},

			switchTab(idx) {
				this.tabIndex = idx
			},

			isActiveSong(plIdx, songIdx) {
				return plIdx === audioManager.activeIndex && songIdx === audioManager.activePlaylist?.currentIndex
			},

			playSong(si) {
				if (this.tabIndex !== audioManager.activeIndex) {
					audioManager.setActivePlaylist(this.tabIndex)
				}
				audioManager.play(si)
			},

			createPlaylist() {
				uni.showModal({
					title: '新建歌单',
					editable: true,
					placeholderText: '输入歌单名称',
					success: (res) => {
						if (res.confirm && res.content) {
							const idx = audioManager.createPlaylist(res.content.trim())
							this.tabIndex = idx
						}
					}
				})
			},

			editPlaylist(idx) {
				const pl = this.playlists[idx]
				if (!pl) return
				const canDelete = this.playlists.length > 1
				const actions = ['重命名']
				if (canDelete) actions.push('删除歌单')

				uni.showActionSheet({
					itemList: actions,
					success: (res) => {
						if (res.tapIndex === 0) {
							this._renamePlaylist(idx, pl.name)
						} else if (res.tapIndex === 1 && canDelete) {
							this._deletePlaylist(idx)
						}
					}
				})
			},

			_renamePlaylist(idx, oldName) {
				uni.showModal({
					title: '重命名歌单',
					editable: true,
					placeholderText: '输入新名称',
					content: oldName,
					success: (res) => {
						if (res.confirm && res.content) {
							audioManager.renamePlaylist(idx, res.content.trim())
						}
					}
				})
			},

			_deletePlaylist(idx) {
				uni.showModal({
					title: '删除歌单',
					content: '确定删除歌单「' + this.playlists[idx].name + '」？歌曲将无法恢复',
					confirmColor: '#e17055',
					success: (res) => {
						if (res.confirm) {
							const ok = audioManager.deletePlaylist(idx)
							if (!ok) {
								uni.showToast({ title: '至少保留一个歌单', icon: 'none' })
							}
						}
					}
				})
			},

			removeSong(si) {
				const song = this.currentPlaylist?.songs[si]
				if (!song) return
				uni.showModal({
					title: '删除歌曲',
					content: '确定从「' + this.currentPlaylist.name + '」中删除「' + song.title + '」吗？',
					confirmColor: '#e17055',
					success: (res) => {
						if (res.confirm) {
							audioManager.removeSongAt(this.tabIndex, si)
							uni.showToast({ title: '已删除', icon: 'none' })
						}
					}
				})
			},

			clearCurrent() {
				const pl = this.currentPlaylist
				if (!pl || pl.songs.length === 0) return
				uni.showModal({
					title: '清空歌单',
					content: '确定清空「' + pl.name + '」中全部 ' + pl.songs.length + ' 首歌曲吗？',
					confirmColor: '#e17055',
					success: (res) => {
						if (res.confirm) {
							audioManager.clearPlaylistAt(this.tabIndex)
							uni.showToast({ title: '已清空', icon: 'none' })
						}
					}
				})
			},

			addToCurrent() {
				const targetIdx = this.tabIndex

				pickAudioFiles((files) => {
					if (files.length === 0) return
					const added = audioManager.addSongsAt(targetIdx, files)
					if (added > 0) {
						uni.showToast({ title: '已添加 ' + added + ' 首', icon: 'none' })
					} else {
						uni.showToast({ title: '歌曲已在列表中', icon: 'none' })
					}
				}, (err) => {
					console.error('选择文件失败:', err)
				})
			},

			getCoverGradient(index) {
				const gradients = [
					'linear-gradient(135deg, #5e6ad2, #828fff)',
					'linear-gradient(135deg, #5e6ad2, #7a7fad)',
					'linear-gradient(135deg, #5e69d1, #5e6ad2)',
					'linear-gradient(135deg, #5e6ad2, #6b74d4)',
					'linear-gradient(135deg, #5e69d1, #828fff)',
					'linear-gradient(135deg, #5e6ad2, #5e69d1)',
					'linear-gradient(135deg, #7a7fad, #5e6ad2)',
					'linear-gradient(135deg, #5e6ad2, #8a90d0)'
				]
				return gradients[index % gradients.length]
			},

			formatSize(bytes) {
				if (!bytes) return '0 B'
				const size = Number(bytes)
				if (size < 1024) return size + ' B'
				if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
				return (size / (1024 * 1024)).toFixed(1) + ' MB'
			},

			clearCache() {
				uni.showModal({
					title: '清理缓存',
					content: '确定清理播放缓存吗？将停止播放并释放播放器资源。',
					confirmColor: '#e17055',
					success: (res) => {
						if (res.confirm) {
							audioManager.release()
							uni.showToast({ title: '缓存已清理', icon: 'none' })
						}
					}
				})
			}
		}
	}
</script>

<style>
	.playlist-page {
		min-height: 100vh;
		background: #010102;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.bg-layer {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	.bg-grain {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(rgba(94,106,210,0.03) 1rpx, transparent 1rpx);
		background-size: 30rpx 30rpx;
	}

	/* ===== 顶部栏 ===== */
	.top-bar {
		padding: 100rpx 40rpx 24rpx;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
		z-index: 5;
		box-sizing: border-box;
	}

	.page-title {
		font-size: 40rpx;
		font-weight: 800;
		color: #f7f8f8;
		letter-spacing: -1rpx;
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.action-btn {
		font-size: 26rpx;
		color: #5e6ad2;
		padding: 12rpx 24rpx;
		background: #0f1011;
		border: 1rpx solid #23252a;
		border-radius: 8px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.action-btn:active {
		transform: scale(0.95);
		background: #141516;
	}

	/* ===== 歌单横滚 ===== */
	.tab-scroll {
		white-space: nowrap;
		padding: 12rpx 40rpx 24rpx;
		position: relative;
		z-index: 5;
	}

	.tab-list {
		display: inline-flex;
		gap: 24rpx;
	}

	.tab-item {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		padding: 24rpx 36rpx 20rpx;
		border-radius: 8px;
		background: #0f1011;
		min-width: 140rpx;
		transition: all 0.25s ease;
		position: relative;
		border: 1rpx solid transparent;
	}

	.tab-item.active {
		background: #141516;
		border-color: #23252a;
	}

	.tab-bar {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 40rpx;
		height: 3rpx;
		border-radius: 2rpx;
		background: transparent;
		transition: all 0.3s ease;
	}

	.tab-bar.bar-active {
		width: 60rpx;
		background: #8a8f98;
	}

	.tab-bar.bar-playing {
		width: 50rpx;
		background: #5e6ad2;
	}

	.tab-name {
		font-size: 26rpx;
		color: #8a8f98;
		font-weight: 500;
		line-height: 1.4;
		transition: color 0.25s ease;
	}

	.tab-item.active .tab-name {
		color: #d0d6e0;
	}

	.tab-item.playing .tab-name {
		color: #f7f8f8;
	}

	.tab-count {
		font-size: 20rpx;
		color: #62666d;
		margin-top: 4rpx;
		transition: color 0.25s ease;
	}

	.tab-item.active .tab-count {
		color: #8a8f98;
	}

	/* ===== 当前歌单头部 ===== */
	.playlist-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12rpx 40rpx 24rpx;
		position: relative;
		z-index: 5;
	}

	.pl-header-title {
		font-size: 24rpx;
		color: #8a8f98;
		font-weight: 500;
	}

	.pl-header-actions {
		display: flex;
		gap: 32rpx;
	}

	.pl-action {
		font-size: 26rpx;
		color: #8a8f98;
		padding: 6rpx 0;
		transition: color 0.2s ease;
	}

	.pl-action-add {
		color: #5e6ad2;
	}

	.pl-action:active {
		color: #d0d6e0;
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
		padding-bottom: 120rpx;
	}

	.empty-notes {
		position: relative;
		width: 120rpx;
		height: 100rpx;
		margin-bottom: 28rpx;
	}

	.empty-note {
		position: absolute;
		font-size: 56rpx;
		color: rgba(94,106,210,0.06);
	}

	.n1 { top: 0; left: 50%; transform: translateX(-50%); animation: noteFloat 3s ease-in-out infinite; }
	.n2 { bottom: 0; right: 0; animation: noteFloat 3s ease-in-out 0.8s infinite; }

	@keyframes noteFloat {
		0%,100% { opacity: 0.25; transform: translateY(0); }
		50% { opacity: 0.6; transform: translateY(-12rpx); }
	}

	.empty-text {
		font-size: 30rpx;
		color: #8a8f98;
		margin-bottom: 8rpx;
		font-weight: 500;
	}

	.empty-hint {
		font-size: 24rpx;
		color: #62666d;
	}

	/* ===== 歌曲列表 ===== */
	.song-list {
		flex: 1;
		padding: 0 30rpx;
		position: relative;
		z-index: 5;
	}

	.song-item {
		display: flex;
		align-items: center;
		padding: 22rpx 24rpx;
		border-radius: 20rpx;
		margin-bottom: 6rpx;
		transition: all 0.2s ease;
	}

	.song-item:active {
		background: #0f1011;
		transform: scale(0.98);
	}

	.song-item.active {
		background: #141516;
		border: 1rpx solid #23252a;
	}

	.song-cover {
		width: 72rpx;
		height: 72rpx;
		border-radius: 16rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-right: 20rpx;
		box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.3);
	}

	.cover-num {
		font-size: 24rpx;
		color: #8a8f98;
		font-weight: 600;
	}

	.cover-eq {
		display: flex;
		align-items: flex-end;
		gap: 4rpx;
		height: 32rpx;
	}

	.eq-bar {
		width: 4rpx;
		border-radius: 2rpx;
		background: #f7f8f8;
	}

	.e1 { height: 16rpx; animation: eqAni 0.6s ease-in-out infinite; }
	.e2 { height: 26rpx; animation: eqAni 0.6s ease-in-out 0.15s infinite; }
	.e3 { height: 10rpx; animation: eqAni 0.6s ease-in-out 0.3s infinite; }

	@keyframes eqAni {
		0%,100% { transform: scaleY(1); }
		50% { transform: scaleY(0.4); }
	}

	.song-meta {
		flex: 1;
		overflow: hidden;
	}

	.song-name {
		font-size: 28rpx;
		color: #d0d6e0;
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: color 0.25s ease;
	}

	.playing-text {
		color: #f7f8f8;
		font-weight: 600;
	}

	.song-info-text {
		font-size: 22rpx;
		color: #8a8f98;
		margin-top: 4rpx;
		display: block;
	}

	.broken-text {
		color: #e17055;
	}

	.song-status {
		width: 36rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.playing-indicator {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		background: #5e6ad2;
		box-shadow: 0 0 10rpx rgba(94,106,210,0.4);
		animation: dotPulse 1.2s ease-in-out infinite;
	}

	@keyframes dotPulse {
		0%,100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.7); }
	}

	.list-footer {
		padding: 56rpx 0 80rpx;
		text-align: center;
	}

	.footer-text {
		font-size: 22rpx;
		color: #62666d;
	}
</style>
