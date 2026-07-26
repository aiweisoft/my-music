/**
 * 跨平台音频文件选择器
 * - APP-PLUS (Android): 使用 plus.android 原生文件选择器
 * - H5 / 小程序: 使用 uni.chooseFile
 */
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
let _pickCallback = null
let _pickErrorCallback = null

function pickAudioFilesNative(callback, errorCallback) {
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

		const REQ_CODE = 99987
		activity._oldOnActivityResult = activity.onActivityResult
		activity.onActivityResult = function(requestCode, resultCode, intent) {
			handleActivityResult(requestCode, resultCode, intent)
		}
		activity.startActivityForResult(intent, REQ_CODE)
	} catch (e) {
		console.error('打开文件选择器失败:', e)
		if (_pickErrorCallback) _pickErrorCallback(e)
		_pickCallback = null
		_pickErrorCallback = null
	}
}

function handleActivityResult(requestCode, resultCode, intent) {
	const activity = plus.android.runtimeMainActivity()
	try {
		activity.onActivityResult = activity._oldOnActivityResult || null
	} catch (e) {}
	activity._oldOnActivityResult = null

	if (requestCode !== 99987) return

	const Activity = plus.android.importClass('android.app.Activity')
	if (resultCode !== Activity.RESULT_OK || !intent) {
		_pickCallback = null
		_pickErrorCallback = null
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
				const itemUri = plus.android.invoke(item, 'getUri')
				takePersistablePermission(itemUri)
				const info = resolveUriInfo(itemUri)
				if (info) files.push(info)
			}
		} else {
			const itemUri = intent.getData()
			if (itemUri) {
				takePersistablePermission(itemUri)
				const info = resolveUriInfo(itemUri)
				if (info) files.push(info)
			}
		}

		if (_pickCallback) _pickCallback(files)
	} catch (e) {
		console.error('处理文件选择结果失败:', e)
		if (_pickErrorCallback) _pickErrorCallback(e)
	}
	_pickCallback = null
	_pickErrorCallback = null
}

function takePersistablePermission(uri) {
	try {
		const activity = plus.android.runtimeMainActivity()
		const Intent = plus.android.importClass('android.content.Intent')
		activity.getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
	} catch (e) {
		// non-fatal
	}
}

function resolveUriInfo(uri) {
	try {
		const activity = plus.android.runtimeMainActivity()
		const resolver = activity.getContentResolver()
		const context = activity.getApplicationContext()
		const Uri = plus.android.importClass('android.net.Uri')

		if (typeof uri === 'string') {
			uri = Uri.parse(uri)
		}

		let filePath = ''
		let fileName = ''
		let title = ''
		let artist = ''
		let album = ''
		let duration = 0

		try {
			const cursor = resolver.query(uri, null, null, null, null)
			if (cursor && cursor.moveToFirst()) {
				const dataIdx = cursor.getColumnIndex('_data')
				const nameIdx = cursor.getColumnIndex('_display_name')
				if (dataIdx >= 0) filePath = cursor.getString(dataIdx) || ''
				if (nameIdx >= 0) fileName = cursor.getString(nameIdx) || ''
				cursor.close()
			}
		} catch (e) {
			// fallback
		}

		try {
			const MMR = plus.android.importClass('android.media.MediaMetadataRetriever')
			const retriever = new MMR()
			const uriStr = uri.toString()
			if (filePath && filePath.indexOf('content://') !== 0) {
				retriever.setDataSource(filePath)
			} else {
				let ok = false
				try {
					retriever.setDataSource(context, uri)
					ok = true
				} catch (e1) {}
				if (!ok) {
					try {
						const afd = resolver.openAssetFileDescriptor(uri, 'r')
						if (afd) {
							retriever.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength())
							afd.close()
							ok = true
						}
					} catch (e2) {}
				}
				if (!ok) {
					try {
						retriever.setDataSource(uriStr)
						ok = true
					} catch (e3) {}
				}
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
			// MediaMetadataRetriever failed, fallback to filename
		}

		if (!fileName) {
			const uriStr = uri.toString()
			const parts = uriStr.split('/')
			fileName = decodeURIComponent(parts[parts.length - 1] || 'unknown.mp3')
		}

		if (!filePath) {
			filePath = uri.toString()
		}

		if (!title) {
			const dot = fileName.lastIndexOf('.')
			title = dot > 0 ? fileName.substring(0, dot) : fileName
		}

		return {
			path: filePath,
			name: fileName,
			title: title,
			artist: artist || '未知艺术家',
			album: album || '',
			duration: duration,
			size: 0
		}
	} catch (e) {
		const uriStr = (typeof uri === 'string' ? uri : uri.toString())
		const fallbackName = uriStr.split('/').pop() || 'unknown.mp3'
		const dot = fallbackName.lastIndexOf('.')
		return {
			path: uriStr,
			name: fallbackName,
			title: dot > 0 ? fallbackName.substring(0, dot) : fallbackName,
			artist: '未知艺术家',
			album: '',
			duration: 0,
			size: 0
		}
	}
}
// #endif
