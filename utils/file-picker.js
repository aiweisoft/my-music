/**
 * 跨平台音频文件选择器
 * - APP-PLUS (Android): 使用 plus.android 原生文件选择器 + ID3 解析
 * - H5 / 小程序: 使用 uni.chooseFile
 *
 * content:// URI 的解析与落地统一由 content-uri.js 处理。
 */
import { ensureLocalCopy, getLastCopyError } from './content-uri.js'

export function pickAudioFiles(callback, errorCallback) {
	// #ifdef APP-PLUS
	pickAudioFilesNative(callback, errorCallback)
	// #endif

	// #ifndef APP-PLUS
	uni.chooseFile({
		type: 'all',
		count: 99,
		success(res) {
			const files = (res.tempFiles || []).map(f => ({
				path: f.path,
				name: f.name || '',
				uri: '',
				size: f.size || 0
			}))
			callback && callback(files)
		},
		fail(err) {
			console.error('选择文件失败:', err)
			errorCallback && errorCallback(err)
		}
	})
	// #endif
}

// #ifdef APP-PLUS
const REQ_CODE = 99987

let _pickCallback = null
let _pickErrorCallback = null
let _isPicking = false

function pickAudioFilesNative(callback, errorCallback) {
	if (_isPicking) return
	_isPicking = true
	_pickCallback = callback
	_pickErrorCallback = errorCallback

	try {
		const Intent = plus.android.importClass('android.content.Intent')
		const activity = plus.android.runtimeMainActivity()
		const intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
		intent.addCategory(Intent.CATEGORY_OPENABLE)
		intent.setType('audio/*')
		intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
		intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
		intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

		activity._oldOnActivityResult = activity.onActivityResult
		activity.onActivityResult = function(requestCode, resultCode, intent) {
			handleActivityResult(requestCode, resultCode, intent)
		}
		activity.startActivityForResult(intent, REQ_CODE)
	} catch (e) {
		console.error('打开文件选择器失败:', e)
		const errorCallback = _pickErrorCallback
		finishPicking()
		if (errorCallback) errorCallback(e)
	}
}

function finishPicking() {
	_isPicking = false
	_pickCallback = null
	_pickErrorCallback = null
}

function handleActivityResult(requestCode, resultCode, intent) {
	const activity = plus.android.runtimeMainActivity()

	if (requestCode !== REQ_CODE) {
		// 其它 Activity 的回调交还给原来的处理逻辑
		try {
			if (activity._oldOnActivityResult) {
				activity._oldOnActivityResult(requestCode, resultCode, intent)
			}
		} catch (e) {}
		return
	}

	try {
		activity.onActivityResult = activity._oldOnActivityResult || null
	} catch (e) {}
	activity._oldOnActivityResult = null

	const callback = _pickCallback
	const errorCallback = _pickErrorCallback

	const Activity = plus.android.importClass('android.app.Activity')
	if (resultCode !== Activity.RESULT_OK || !intent) {
		finishPicking()
		return
	}

	try {
		const files = []
		const clipData = intent.getClipData()
		const total = clipData ? (() => {
			try {
				return clipData.getItemCount()
			} catch (e) {
				return plus.android.invoke(clipData, 'getItemCount')
			}
		})() : 1

		if (total > 0) {
			uni.showLoading({ title: '正在导入 0/' + total, mask: true })
		}

		if (clipData) {
			for (let i = 0; i < total; i++) {
				uni.showLoading({ title: '正在导入 ' + (i + 1) + '/' + total, mask: true })
				let item
				try {
					item = clipData.getItemAt(i)
				} catch (e) {
					item = plus.android.invoke(clipData, 'getItemAt', i)
				}
				const info = resolveUriInfo(plus.android.invoke(item, 'getUri'))
				if (info) files.push(info)
			}
		} else {
			const dataUri = intent.getData()
			if (dataUri) {
				const info = resolveUriInfo(dataUri)
				if (info) files.push(info)
			}
		}

		uni.hideLoading()
		if (callback) callback(files)

		const failed = total - files.length
		if (failed > 0) {
			// 把失败原因直接摆到用户面前，避免只能靠日志猜
			setTimeout(() => {
				uni.showModal({
					title: failed === total ? '导入失败' : '部分文件导入失败',
					content: (failed === total ? '' : '成功 ' + files.length + ' 首，失败 ' + failed + ' 首。\n') +
						'原因：' + (getLastCopyError() || '未知'),
					showCancel: false
				})
			}, 300)
		}
	} catch (e) {
		uni.hideLoading()
		console.error('处理文件选择结果失败:', e)
		if (errorCallback) errorCallback(e)
	}
	finishPicking()
}

function takePersistablePermission(uri) {
	try {
		const activity = plus.android.runtimeMainActivity()
		const Intent = plus.android.importClass('android.content.Intent')
		activity.getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
	} catch (e) {
		// 部分 provider 不支持持久授权，忽略即可
	}
}

function resolveUriInfo(uri) {
	const uriStr = typeof uri === 'string' ? uri : uri.toString()
	let fileName = ''
	let title = ''
	let artist = ''
	let album = ''
	let duration = 0

	try {
		const activity = plus.android.runtimeMainActivity()
		const resolver = activity.getContentResolver()
		const Uri = plus.android.importClass('android.net.Uri')
		const parsedUri = typeof uri === 'string' ? Uri.parse(uri) : uri

		takePersistablePermission(parsedUri)

		// 一律复制到应用私有目录：这是唯一可靠的长期播放路径
		const localPath = ensureLocalCopy(uriStr)
		if (!localPath) {
			console.warn('[file-picker] 复制失败，跳过该文件:', uriStr, getLastCopyError())
			return null
		}

		try {
			const cursor = plus.android.invoke(resolver, 'query', parsedUri, null, null, null, null)
			if (cursor && plus.android.invoke(cursor, 'moveToFirst')) {
				const nameIdx = plus.android.invoke(cursor, 'getColumnIndex', '_display_name')
				if (nameIdx >= 0) fileName = plus.android.invoke(cursor, 'getString', nameIdx) || ''
				plus.android.invoke(cursor, 'close')
			}
		} catch (e) {}

		try {
			const MMR = plus.android.importClass('android.media.MediaMetadataRetriever')
			const retriever = new MMR()
			retriever.setDataSource(localPath)

			const t = retriever.extractMetadata(7)
			if (t) title = t
			const a = retriever.extractMetadata(2)
			if (a) artist = a
			const al = retriever.extractMetadata(1)
			if (al) album = al
			const d = retriever.extractMetadata(9)
			if (d) duration = parseInt(d) || 0

			retriever.release()
		} catch (e) {
			// 读不到标签就用文件名兜底
		}

		if (!fileName) {
			const parts = localPath.split('/')
			fileName = parts[parts.length - 1] || 'unknown.mp3'
		}

		if (!title) {
			const dot = fileName.lastIndexOf('.')
			title = dot > 0 ? fileName.substring(0, dot) : fileName
		}

		return {
			path: localPath,
			uri: uriStr,
			name: fileName,
			title: title,
			artist: artist || '未知艺术家',
			album: album || '',
			duration: duration,
			size: 0
		}
	} catch (e) {
		console.error('解析音频信息失败:', e)
		return null
	}
}
// #endif
