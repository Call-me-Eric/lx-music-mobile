import { decodeName, formatPlayTime } from '../../index'
import { normalizePic, signedGet } from './api'

const stripTitle = (title) => decodeName(String(title || '').replace(/<[^>]+>/g, '')).trim()

const formatDuration = (duration) => {
  if (typeof duration == 'number') return formatPlayTime(duration)
  if (typeof duration != 'string' || !duration.includes(':')) return formatPlayTime(0)
  const parts = duration.split(':').map(n => parseInt(n, 10))
  if (parts.some(n => Number.isNaN(n))) return duration
  const seconds = parts.reduce((acc, n) => acc * 60 + n, 0)
  return formatPlayTime(seconds)
}

export default {
  limit: 20,
  total: 0,
  page: 0,
  allPage: 1,
  handleResult(rawList) {
    const list = []
    if (!Array.isArray(rawList)) return list
    for (const info of rawList) {
      const bvid = info?.bvid
      const name = stripTitle(info.title)
      if (!bvid || !name || (info?.type && info.type != 'video')) continue
      const types = [
        { type: '320k', size: null },
        { type: '128k', size: null },
      ]
      list.push({
        name,
        singer: decodeName(info.author || info.author_name || ''),
        source: 'bili',
        songmid: bvid,
        albumId: info.aid != null ? String(info.aid) : '',
        interval: formatDuration(info.duration),
        albumName: '',
        lrc: null,
        img: normalizePic(info.pic),
        otherSource: null,
        types,
        _types: {
          '320k': { size: null },
          '128k': { size: null },
        },
        typeUrl: {},
      })
    }
    return list
  },
  async search(str, page = 1, limit) {
    if (limit == null || limit > this.limit) limit = this.limit
    const { body } = await signedGet('/x/web-interface/wbi/search/type', {
      search_type: 'video',
      keyword: str,
      page,
      page_size: limit,
    })
    if (body?.code !== 0) throw new Error(body?.message || '搜索失败')
    const data = body.data || {}
    const list = this.handleResult(data.result)
    const total = Number(data.numResults) || 0
    const allPage = Number(data.numPages) || (total ? Math.ceil(total / limit) : 1)
    this.total = total
    this.page = page
    this.allPage = allPage || 1
    return {
      list,
      allPage: this.allPage,
      total,
      limit,
      source: 'bili',
    }
  },
}
