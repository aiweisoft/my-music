/**
 * Android content:// URI 工具（App 平台）
 * - 供 file-picker.js / audio-manager.js 共用，避免两处重复实现
 * - 非 App 平台统一返回 null，调用方按「路径不可用」处理
 *
 * 设计要点：
 * 1. 优先把 content:// 解析成真实文件路径（externalstorage / MediaStore / Downloads）
 * 2. 解析不出或应用无读取权限时，复制到应用私有目录（不是缓存目录，不会被系统清理）
 * 3. 复制文件按 URI 哈希命名，避免不同目录下同名文件互相覆盖
 */

const AUDIO_DIR = 'audio'
const MAX_STEM_LENGTH = 32

// #ifdef APP-PLUS

function appContext() {
	return plus.android.runtimeMainActivity().getApplicationContext()
}

function hashString(str) {
	let hash = 5381
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
	}
	return (hash >>> 0).toString(36)
}

function sanitizeStem(stem) {
	return String(stem || 'audio')
		.replace(/[\\/:*?"<>|\s]+/g, '_')
		.replace(/^[._]+/, '')
		.slice(0, MAX_STEM_LENGTH) || 'audio'
}

function extFromMime(mimeType) {
	switch (mimeType) {
		case 'audio/mpeg':
		case 'audio/mp3':
			return 'mp3'
		case 'audio/mp4':
		case 'audio/m4a':
		case 'audio/x-m4a':
			return 'm4a'
		case 'audio/flac':
		case 'audio/x-flac':
			return 'flac'
		case 'audio/wav':
		case 'audio/x-wav':
			return 'wav'
		case 'audio/ogg':
		case 'audio/x-ogg':
			return 'ogg'
		case 'audio/aac':
			return 'aac'
		default:
			return 'mp3'
	}
}

function buildFileName(uriStr, displayName, mimeType) {
	const dot = displayName ? displayName.lastIndexOf('.') : -1
	const stem = sanitizeStem(dot > 0 ? displayName.substring(0, dot) : displayName)
	const rawExt = dot > 0 ? displayName.substring(dot + 1).toLowerCase() : ''
	const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : extFromMime(mimeType)
	return hashString(uriStr) + '_' + stem + '.' + ext
}

function fileExists(path) {
	if (!path) return false
	try {
		const File = plus.android.importClass('java.io.File')
		const file = new File(path)
		if (!plus.android.invoke(file, 'exists')) return false
		const length = plus.android.invoke(file, 'length')
		return typeof length === 'number' && length > 0
	} catch (e) {
		return false
	}
}

function isReadable(path) {
	if (!path) return false
	try {
		const FileInputStream = plus.android.importClass('java.io.FileInputStream')
		const stream = new FileInputStream(path)
		plus.android.invoke(stream, 'close')
		return true
	} catch (e) {
		return false
	}
}

function audioDir() {
	try {
		const context = appContext()
		const File = plus.android.importClass('java.io.File')
		let base = null
		try {
			base = context.getExternalFilesDir(null)
		} catch (e) {}
		if (!base) base = context.getFilesDir()
		if (!base) return null

		const dir = new File(base, AUDIO_DIR)
		if (!plus.android.invoke(dir, 'exists')) {
			plus.android.invoke(dir, 'mkdirs')
		}
		if (!plus.android.invoke(dir, 'isDirectory')) return base
		return dir
	} catch (e) {
		console.error('[content-uri] 获取应用音频目录失败:', e)
		return null
	}
}

function queryDisplayInfo(resolver, parsedUri) {
	let name = ''
	let mime = ''
	try {
		const cursor = resolver.query(parsedUri, null, null, null, null)
		if (cursor && cursor.moveToFirst()) {
			const nameIdx = cursor.getColumnIndex('_display_name')
			if (nameIdx >= 0) name = cursor.getString(nameIdx) || ''
			const mimeIdx = cursor.getColumnIndex('mime_type')
			if (mimeIdx >= 0) mime = cursor.getString(mimeIdx) || ''
			cursor.close()
		}
	} catch (e) {}

	if (!mime) {
		try {
			mime = plus.android.invoke(resolver, 'getType', parsedUri) || ''
		} catch (e) {}
	}
	return { name, mime }
}

/**
 * 把 content:// 文件复制到应用私有目录，返回复制后的绝对路径
 * 同一 URI 只会复制一次（按哈希命名，可重复调用）
 */
function copyToAppDir(uriStr) {
	try {
		const resolver = plus.android.runtimeMainActivity().getContentResolver()
		const Uri = plus.android.importClass('android.net.Uri')
		const parsedUri = plus.android.invoke(Uri, 'parse', uriStr)
		const info = queryDisplayInfo(resolver, parsedUri)

		const dir = audioDir()
		if (!dir) return null

		const File = plus.android.importClass('java.io.File')
		const target = new File(dir, buildFileName(uriStr, info.name, info.mime))
		const targetPath = plus.android.invoke(target, 'getAbsolutePath')

		if (fileExists(targetPath)) return targetPath
		plus.android.invoke(target, 'delete')

		const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
		const fos = new FileOutputStream(target)

		try {
			const input = plus.android.invoke(resolver, 'openInputStream', parsedUri)
			plus.android.invoke(input, 'transferTo', fos)
			plus.android.invoke(input, 'close')
		} catch (e1) {
			console.warn('[content-uri] transferTo 失败，尝试 FileChannel:', e1)
			try {
				const pfd = plus.android.invoke(resolver, 'openFileDescriptor', parsedUri, 'r')
				const descriptor = plus.android.invoke(pfd, 'getFileDescriptor')
				const FileInputStream = plus.android.importClass('java.io.FileInputStream')
				const Long = plus.android.importClass('java.lang.Long')
				const fis = new FileInputStream(descriptor)
				const srcChannel = plus.android.invoke(fis, 'getChannel')
				const dstChannel = plus.android.invoke(fos, 'getChannel')
				plus.android.invoke(srcChannel, 'transferTo', 0, Long.MAX_VALUE, dstChannel)
				plus.android.invoke(srcChannel, 'close')
				plus.android.invoke(dstChannel, 'close')
				plus.android.invoke(fis, 'close')
				plus.android.invoke(pfd, 'close')
			} catch (e2) {
				console.warn('[content-uri] FileChannel 失败，使用流复制:', e2)
				const input = plus.android.invoke(resolver, 'openInputStream', parsedUri)
				const BufferedInputStream = plus.android.importClass('java.io.BufferedInputStream')
				const BufferedOutputStream = plus.android.importClass('java.io.BufferedOutputStream')
				const bis = new BufferedInputStream(input, 32768)
				const bos = new BufferedOutputStream(fos, 32768)
				let b
				while ((b = plus.android.invoke(bis, 'read')) !== -1) {
					plus.android.invoke(bos, 'write', b)
				}
				plus.android.invoke(bos, 'flush')
				plus.android.invoke(bis, 'close')
				plus.android.invoke(bos, 'close')
			}
		}
		plus.android.invoke(fos, 'close')

		if (!fileExists(targetPath)) {
			console.error('[content-uri] 复制后文件为空，已删除:', targetPath)
			plus.android.invoke(target, 'delete')
			return null
		}
		return targetPath
	} catch (e) {
		console.error('[content-uri] 复制到应用目录失败:', e)
		return null
	}
}

// #endif

/**
 * content:// → 真实文件路径（不复制）
 */
function resolveContentUriPath(uriStr) {
	// #ifdef APP-PLUS
	if (!plus.android) return null
	const decoded = decodeURIComponent(uriStr)

	const extMatch = decoded.match(/com\.android\.externalstorage\.documents\/document\/([^/]+)$/)
	if (extMatch) {
		const docPath = extMatch[1]
		const colonIdx = docPath.indexOf(':')
		if (colonIdx >= 0) {
			const storage = docPath.substring(0, colonIdx)
			const relPath = docPath.substring(colonIdx + 1)
			if (storage === 'primary') return '/storage/emulated/0/' + relPath
			return '/storage/' + storage + '/' + relPath
		}
	}

	const mediaMatch = decoded.match(/com\.android\.providers\.media\.documents\/document\/audio:(\d+)$/)
	if (mediaMatch) {
		try {
			const resolver = plus.android.runtimeMainActivity().getContentResolver()
			const MediaStore = plus.android.importClass('android.provider.MediaStore$Audio$Media')
			const Uri = plus.android.importClass('android.net.Uri')
			const mediaUri = Uri.withAppendedPath(MediaStore.EXTERNAL_CONTENT_URI, mediaMatch[1])
			const cursor = resolver.query(mediaUri, null, null, null, null)
			if (cursor && cursor.moveToFirst()) {
				const dataIdx = cursor.getColumnIndex('_data')
				if (dataIdx >= 0) {
					const path = cursor.getString(dataIdx)
					if (path) {
						cursor.close()
						return path
					}
				}
				const relIdx = cursor.getColumnIndex('relative_path')
				const nameIdx = cursor.getColumnIndex('_display_name')
				if (relIdx >= 0 && nameIdx >= 0) {
					const relPath = cursor.getString(relIdx) || ''
					const name = cursor.getString(nameIdx) || ''
					cursor.close()
					if (relPath && name) return '/storage/emulated/0/' + relPath + name
				}
				cursor.close()
			}
		} catch (e) {}
	}

	const dlMatch = decoded.match(/com\.android\.providers\.downloads\.documents\/document\/(\d+)$/)
	if (dlMatch) {
		try {
			const resolver = plus.android.runtimeMainActivity().getContentResolver()
			const Uri = plus.android.importClass('android.net.Uri')
			const dlUri = Uri.parse('content://downloads/public_downloads')
			const cursor = resolver.query(dlUri, null, '_id=?', [dlMatch[1]], null)
			if (cursor && cursor.moveToFirst()) {
				const dataIdx = cursor.getColumnIndex('_data')
				if (dataIdx >= 0) {
					const path = cursor.getString(dataIdx)
					if (path) {
						cursor.close()
						return path
					}
				}
				cursor.close()
			}
		} catch (e) {}
	}

	return null
	// #endif
	return null
}

/**
 * 保证拿到一个当前可播放的本地路径
 * - 普通路径：存在即可用，否则返回 null
 * - content://：能直接读就用原文件，读不了就复制到应用私有目录
 */
function ensureLocalAudioFile(uriStr) {
	// #ifdef APP-PLUS
	if (!uriStr) return null
	if (!plus.android) return null

	if (uriStr.indexOf('content://') !== 0) {
		return fileExists(uriStr) ? uriStr : null
	}

	const resolved = resolveContentUriPath(uriStr)
	if (resolved && fileExists(resolved) && isReadable(resolved)) {
		return resolved
	}

	return copyToAppDir(uriStr)
	// #endif
	return null
}

export { resolveContentUriPath, ensureLocalAudioFile }
