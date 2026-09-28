import { loadAccount } from './account'
import { getAudioUrl, getVideoInfo } from './api'
import { downloadBiliAudio, getCachedAudioFile, intervalToSeconds } from './cache'
import comment from './comment'
import musicSearch from './musicSearch'

const CACHE_MAX_SECONDS = 20 * 60

const bili = {
  musicSearch,
  comment,

  init() {
    return loadAccount()
  },

  getLyric() {
    return {
      promise: Promise.resolve({
        lyric: '',
        tlyric: '',
        rlyric: '',
        lxlyric: '',
      }),
      cancelHttp() {},
    }
  },

  getPic(songInfo) {
    if (songInfo.img) return Promise.resolve(songInfo.img)
    return getVideoInfo(songInfo.songmid).then(info => info.pic || '')
  },

  getMusicDetailPageUrl(songInfo) {
    if (!songInfo.songmid) return ''
    return `https://www.bilibili.com/video/${songInfo.songmid}`
  },

  getMusicUrl(songInfo, type) {
    const signal = { canceled: false, stop: null }
    const quality = type == 'flac' || type == '320k' || type == '128k' ? type : '128k'
    const promise = (async() => {
      await loadAccount()
      if (signal.canceled) throw new Error('取消请求')
      const cached = await getCachedAudioFile(songInfo.songmid, quality)
      if (cached) return { url: cached, type: quality }
      const info = await getVideoInfo(songInfo.songmid)
      if (signal.canceled) throw new Error('取消请求')
      const audio = await getAudioUrl(info.bvid, info.cid, quality)
      const seconds = intervalToSeconds(songInfo.interval) || info.duration
      if (seconds > 0 && seconds <= CACHE_MAX_SECONDS) {
        try {
          const path = await downloadBiliAudio(audio.url, info.bvid, quality, signal)
          return { url: path, type: quality }
        } catch (err) {
          if (signal.canceled || err?.message == '取消请求') throw err
        }
      }
      return { url: audio.url, type: quality }
    })()
    return {
      promise,
      cancelHttp() {
        signal.canceled = true
        signal.stop?.()
      },
    }
  },
}

export default bili
