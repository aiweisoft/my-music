/**
 * Android content:// 工具（App 平台）
 * - 供 file-picker.js / audio-manager.js 共用，避免两处重复实现
 * - 非 App 平台统一返回 null，调用方按「路径不可用」处理
 *
 * 设计要点：
 * 1. 导入时一律把 content:// 文件复制到应用私有目录（长期可用，不依赖 SAF 授权）
 * 2. 复制文件按 URI 哈希命名，避免不同目录下同名文件互相覆盖
 * 3. 保留原始 content:// URI，副本丢失时可重新复制
 * 4. 路径拼接全程使用字符串，不要用 Java 对象构造 File / FileOutputStream
 *    （5+ 运行时对「对象当构造参数」的桥接不可靠，会静默抛异常）
 */

const AUDIO_DIR = 'audio'
const MAX_STEM_LENGTH = 32

// 最近一次失败原因，供页面提示用（不含敏感信息）
let _lastError = ''

function setError(step, e) {
	const detail = e ? (e.message || String(e)) : ''
	_lastError = detail ? step + '（' + detail + '）' : step
	console.error('[content-uri]', _lastError)
}

function getLastCopyError() {
	return _lastError
}

function clearLastCopyError() {
	_lastError = ''
}

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

/**
 * 应用私有音频目录（字符串路径，末尾带 /）
 * 优先 _doc（应用私有文档目录），拿不到再退 Android 的 getFilesDir
 */
function audioDirPath() {
	let base = ''
	try {
		base = plus.io.convertLocalFileSystemURL('_doc/')
	} catch (e) {}

	if (!base) {
		try {
			const file = appContext().getFilesDir()
			base = plus.android.invoke(file, 'getAbsolutePath') || ''
		} catch (e) {}
	}

	if (!base) {
		setError('无法获取应用私有目录')
		return ''
	}

	if (base.charAt(base.length - 1) !== '/') base += '/'
	const dirPath = base + AUDIO_DIR + '/'

	try {
		const File = plus.android.importClass('java.io.File')
		const dir = new File(dirPath)
		if (!plus.android.invoke(dir, 'exists')) {
			plus.android.invoke(dir, 'mkdirs')
		}
	} catch (e) {
		setError('创建音频目录失败', e)
	}

	return dirPath
}

function queryDisplayInfo(resolver, parsedUri) {
	let name = ''
	let mime = ''
	try {
		const cursor = plus.android.invoke(resolver, 'query', parsedUri, null, null, null, null)
		if (cursor && plus.android.invoke(cursor, 'moveToFirst')) {
			const nameIdx = plus.android.invoke(cursor, 'getColumnIndex', '_display_name')
			if (nameIdx >= 0) name = plus.android.invoke(cursor, 'getString', nameIdx) || ''
			const mimeIdx = plus.android.invoke(cursor, 'getColumnIndex', 'mime_type')
			if (mimeIdx >= 0) mime = plus.android.invoke(cursor, 'getString', mimeIdx) || ''
			plus.android.invoke(cursor, 'close')
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
	clearLastCopyError()

	try {
		const dirPath = audioDirPath()
		if (!dirPath) return null

		const resolver = plus.android.runtimeMainActivity().getContentResolver()
		const Uri = plus.android.importClass('android.net.Uri')
		const parsedUri = Uri.parse(uriStr)
		if (!parsedUri) {
			setError('无法解析 URI')
			return null
		}

		const info = queryDisplayInfo(resolver, parsedUri)
		const targetPath = dirPath + buildFileName(uriStr, info.name, info.mime)

		if (fileExists(targetPath)) return targetPath

		try {
			const File = plus.android.importClass('java.io.File')
			plus.android.invoke(new File(targetPath), 'delete')
		} catch (e) {}

		try {
			const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
			const fos = new FileOutputStream(targetPath)
			try {
				const input = plus.android.invoke(resolver, 'openInputStream', parsedUri)
				if (!input) {
					setError('openInputStream 返回空')
				} else {
					try {
						// Android 8.0+ 才有 transferTo
						plus.android.invoke(input, 'transferTo', fos)
					} catch (e0) {
						// 低版本兜底：把 InputStream 转成 Channel 分块搬运
						const Channels = plus.android.importClass('java.nio.channels.Channels')
						const ByteBuffer = plus.android.importClass('java.nio.ByteBuffer')
						const srcChannel = plus.android.invoke(Channels, 'newChannel', input)
						const dstChannel = plus.android.invoke(fos, 'getChannel')
						const buffer = plus.android.invoke(ByteBuffer, 'allocate', 65536)
						let n = plus.android.invoke(srcChannel, 'read', buffer)
						while (n !== -1) {
							plus.android.invoke(buffer, 'flip')
							plus.android.invoke(dstChannel, 'write', buffer)
							plus.android.invoke(buffer, 'clear')
							n = plus.android.invoke(srcChannel, 'read', buffer)
						}
						plus.android.invoke(srcChannel, 'close')
						plus.android.invoke(dstChannel, 'close')
					}
					plus.android.invoke(input, 'close')
				}
			} finally {
				plus.android.invoke(fos, 'close')
			}
		} catch (e1) {
			setError('写入音频副本失败', e1)
		}

		if (!fileExists(targetPath)) {
			try {
				const File = plus.android.importClass('java.io.File')
				plus.android.invoke(new File(targetPath), 'delete')
			} catch (e) {}
			if (!_lastError) setError('复制后文件为空或不存在')
			return null
		}

		return targetPath
	} catch (e) {
		setError('复制到应用目录异常', e)
		return null
	}
}

// #endif

/**
 * content:// → 真实文件路径（不复制，仅用于读取元数据等一次性场景）
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
			const cursor = plus.android.invoke(resolver, 'query', mediaUri, null, null, null, null)
			if (cursor && plus.android.invoke(cursor, 'moveToFirst')) {
				const dataIdx = plus.android.invoke(cursor, 'getColumnIndex', '_data')
				if (dataIdx >= 0) {
					const path = plus.android.invoke(cursor, 'getString', dataIdx)
					if (path) {
						plus.android.invoke(cursor, 'close')
						return path
					}
				}
				const relIdx = plus.android.invoke(cursor, 'getColumnIndex', 'relative_path')
				const nameIdx = plus.android.invoke(cursor, 'getColumnIndex', '_display_name')
				if (relIdx >= 0 && nameIdx >= 0) {
					const relPath = plus.android.invoke(cursor, 'getString', relIdx) || ''
					const name = plus.android.invoke(cursor, 'getString', nameIdx) || ''
					plus.android.invoke(cursor, 'close')
					if (relPath && name) return '/storage/emulated/0/' + relPath + name
				}
				plus.android.invoke(cursor, 'close')
			}
		} catch (e) {}
	}

	const dlMatch = decoded.match(/com\.android\.providers\.downloads\.documents\/document\/(\d+)$/)
	if (dlMatch) {
		try {
			const resolver = plus.android.runtimeMainActivity().getContentResolver()
			const Uri = plus.android.importClass('android.net.Uri')
			const dlUri = Uri.parse('content://downloads/public_downloads')
			const cursor = plus.android.invoke(resolver, 'query', dlUri, null, '_id=?', [dlMatch[1]], null)
			if (cursor && plus.android.invoke(cursor, 'moveToFirst')) {
				const dataIdx = plus.android.invoke(cursor, 'getColumnIndex', '_data')
				if (dataIdx >= 0) {
					const path = plus.android.invoke(cursor, 'getString', dataIdx)
					if (path) {
						plus.android.invoke(cursor, 'close')
						return path
					}
				}
				plus.android.invoke(cursor, 'close')
			}
		} catch (e) {}
	}

	return null
	// #endif
	return null
}

/**
 * 文件是否真实存在且非空（仅 App 平台有效）
 */
function localFileExists(path) {
	// #ifdef APP-PLUS
	return fileExists(path)
	// #endif
	return false
}

/**
 * 保证 content:// 音频在应用私有目录里有一份长期可用的副本
 * - 传入普通本地路径：存在则原样返回，不复制
 * - 传入 content://：复制到应用私有目录（已复制过则直接复用）
 *
 * 之所以一律复制而不是直接用原文件路径：SAF 的授权只在当前进程有效，
 * 进程被彻底退出后原路径可能就不可读了，而副本只依赖应用自己的存储。
 */
function ensureLocalCopy(uriStr) {
	// #ifdef APP-PLUS
	if (!uriStr) return null
	if (!plus.android) return null

	if (uriStr.indexOf('content://') !== 0) {
		return fileExists(uriStr) ? uriStr : null
	}
	return copyToAppDir(uriStr)
	// #endif
	return null
}

/**
 * 路径是否为本模块复制出来的副本（用于删除时判断能否清理）
 */
function isManagedCopy(path) {
	// #ifdef APP-PLUS
	const dir = audioDirPath()
	return !!(dir && path && path.indexOf(dir) === 0)
	// #endif
	return false
}

/**
 * 删除本模块复制出来的副本文件（外部路径不会被删除）
 */
function deleteManagedCopy(path) {
	// #ifdef APP-PLUS
	if (!isManagedCopy(path)) return
	try {
		const File = plus.android.importClass('java.io.File')
		plus.android.invoke(new File(path), 'delete')
	} catch (e) {}
	// #endif
}

export {
	resolveContentUriPath,
	ensureLocalCopy,
	localFileExists,
	isManagedCopy,
	deleteManagedCopy,
	getLastCopyError
}
