/**
 * 跨平台音频文件选择器
 * - APP-PLUS (Android): 使用 plus.android 原生文件选择器 + ID3 解析
 * - H5 / 小程序: 使用 uni.chooseFile
 *
 * content:// URI 的解析与落地统一由 content-uri.js 处理。
 */
import { ensureLocalAudioFile } from './content-uri.js'

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

		if (clipData) {
			let count = 0
			try {
				count = clipData.getItemCount()
			} catch (e) {
				count = plus.android.invoke(clipData, 'getItemCount')
			}
			for (let i = 0; i < count; i++) {
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

		if (callback) callback(files)
	} catch (e) {
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
	let filePath = ''

	try {
		const activity = plus.android.runtimeMainActivity()
		const resolver = activity.getContentResolver()
		const context = activity.getApplicationContext()
		const Uri = plus.android.importClass('android.net.Uri')
		const parsedUri = typeof uri === 'string' ? Uri.parse(uri) : uri

		takePersistablePermission(parsedUri)

		try {
			const cursor = resolver.query(parsedUri, null, null, null, null)
			if (cursor && cursor.moveToFirst()) {
				const dataIdx = cursor.getColumnIndex('_data')
				const nameIdx = cursor.getColumnIndex('_display_name')
				if (dataIdx >= 0) filePath = cursor.getString(dataIdx) || ''
				if (nameIdx >= 0) fileName = cursor.getString(nameIdx) || ''
				cursor.close()
			}
		} catch (e) {}

		// 统一由 content-uri.js 决定「直接用真实路径」还是「复制到应用私有目录」
		const local = ensureLocalAudioFile(uriStr)
		if (local) filePath = local

		try {
			const MMR = plus.android.importClass('android.media.MediaMetadataRetriever')
			const retriever = new MMR()

			if (filePath && filePath.indexOf('content://') !== 0) {
				retriever.setDataSource(filePath)
			} else {
				let ok = false
				try {
					retriever.setDataSource(context, parsedUri)
					ok = true
				} catch (e1) {}
				if (!ok) {
					try {
						const afd = resolver.openAssetFileDescriptor(parsedUri, 'r')
						if (afd) {
							retriever.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength())
							afd.close()
							ok = true
						}
					} catch (e2) {}
				}
				if (!ok) retriever.setDataSource(uriStr)
			}

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
	} catch (e) {
		console.warn('解析音频信息失败:', e)
	}

	if (!fileName) {
		const parts = uriStr.split('/')
		fileName = decodeURIComponent(parts[parts.length - 1] || 'unknown.mp3')
	}

	if (!filePath) filePath = uriStr

	if (!title) {
		const dot = fileName.lastIndexOf('.')
		title = dot > 0 ? fileName.substring(0, dot) : fileName
	}

	return {
		path: filePath,
		uri: uriStr,
		name: fileName,
		title: title,
		artist: artist || '未知艺术家',
		album: album || '',
		duration: duration,
		size: 0
	}
}
// #endif
