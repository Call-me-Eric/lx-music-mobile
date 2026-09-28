import { downloadFile, existsFile, mkdir, moveFile, stopDownload, temporaryDirectoryPath, unlink } from '@/utils/fs'
import { getBiliPlayHeaders } from './account'

const folder = () => `${temporaryDirectoryPath}/bili-audio`

export const intervalToSeconds = (interval) => {
  if (!interval || interval == '--/--') return 0
  const parts = String(interval).split(':').map(n => parseInt(n, 10))
  if (!parts.length || parts.some(n => Number.isNaN(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export const biliAudioPath = (bvid, quality) => `${folder()}/${bvid}_${quality}.m4a`

export const getCachedAudioFile = async(bvid, quality) => {
  const path = biliAudioPath(bvid, quality)
  if (!await existsFile(path)) return ''
  return path
}

export const isBiliCachedUrlUsable = async(url) => {
  if (!url) return false
  if (/^https?:\/\//.test(url)) {
    const matched = /[?&]deadline=(\d+)/.exec(url)
    if (!matched) return false
    return Number(matched[1]) * 1000 > Date.now() + 90_000
  }
  return existsFile(url.replace(/^file:\/\//, ''))
}

export const downloadBiliAudio = async(url, bvid, quality, signal) => {
  await mkdir(folder()).catch(() => {})
  const path = biliAudioPath(bvid, quality)
  const tmp = `${path}.part`
  if (await existsFile(tmp)) await unlink(tmp).catch(() => {})
  const task = downloadFile(url, tmp, {
    headers: {
      ...getBiliPlayHeaders(),
      Referer: `https://www.bilibili.com/video/${bvid}`,
    },
  })
  if (signal?.canceled) {
    stopDownload(task.jobId)
    throw new Error('取消请求')
  }
  if (signal) signal.stop = () => { stopDownload(task.jobId) }
  const result = await task.promise
  if (signal?.canceled) {
    await unlink(tmp).catch(() => {})
    throw new Error('取消请求')
  }
  if (![200, 206].includes(result.statusCode) || (result.bytesWritten != null && result.bytesWritten < 1024)) {
    await unlink(tmp).catch(() => {})
    throw new Error('音频缓存失败')
  }
  if (await existsFile(path)) await unlink(path)
  await moveFile(tmp, path)
  return path
}

export const clearBiliAudioFiles = async(bvid) => {
  if (!bvid) return
  await Promise.all(['128k', '320k', 'flac'].map(async quality => {
    const path = biliAudioPath(bvid, quality)
    if (await existsFile(path)) await unlink(path)
    if (await existsFile(`${path}.part`)) await unlink(`${path}.part`)
  }))
}
