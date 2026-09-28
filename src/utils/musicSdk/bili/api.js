import { stringMd5 } from 'react-native-quick-md5'
import { httpFetch } from '../../request'
import { getBiliPlayHeaders, loadAccount } from './account'

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
]

let wbiKeys = null
let wbiExpireAt = 0
const videoCache = new Map()

const getMixinKey = (orig) => mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32)

export const encWbi = (params, imgKey, subKey) => {
  const mixinKey = getMixinKey(imgKey + subKey)
  const queryObj = { ...params, wts: Math.round(Date.now() / 1000) }
  const query = Object.keys(queryObj).sort().map(key => {
    const value = String(queryObj[key]).replace(/[!'()*]/g, '')
    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  }).join('&')
  return `${query}&w_rid=${stringMd5(query + mixinKey)}`
}

export const normalizePic = (pic) => {
  if (!pic) return ''
  if (pic.startsWith('//')) return `https:${pic}`
  return pic
}

export const biliRequest = (url, options = {}) => {
  let requestObj = null
  let canceled = false
  const promise = loadAccount().then(() => {
    if (canceled) return Promise.reject(new Error('取消请求'))
    requestObj = httpFetch(url, {
      method: 'get',
      ...options,
      headers: {
        ...getBiliPlayHeaders(),
        ...options.headers,
      },
    })
    return requestObj.promise
  })
  return {
    promise,
    cancelHttp() {
      canceled = true
      requestObj?.cancelHttp()
    },
  }
}

export const requestJson = async(url, options) => {
  await loadAccount()
  const { body, statusCode, headers } = await httpFetch(url, {
    method: 'get',
    ...options,
    headers: {
      ...getBiliPlayHeaders(),
      Referer: options?.headers?.Referer || 'https://www.bilibili.com',
      ...options?.headers,
    },
  }).promise
  if (statusCode == 412) throw new Error('哔哩哔哩拒绝了请求，请稍后重试')
  return { body, headers, statusCode }
}

const getWbiKeys = async() => {
  if (wbiKeys && wbiExpireAt > Date.now()) return wbiKeys
  const { body } = await requestJson('https://api.bilibili.com/x/web-interface/nav')
  const imgUrl = body?.data?.wbi_img?.img_url
  const subUrl = body?.data?.wbi_img?.sub_url
  if (!imgUrl || !subUrl) throw new Error('获取哔哩哔哩签名失败')
  wbiKeys = {
    imgKey: imgUrl.split('/').pop().split('.')[0],
    subKey: subUrl.split('/').pop().split('.')[0],
  }
  wbiExpireAt = Date.now() + 30 * 60 * 1000
  return wbiKeys
}

export const signedGet = async(path, params, headers) => {
  const keys = await getWbiKeys()
  const qs = encWbi(params, keys.imgKey, keys.subKey)
  return requestJson(`https://api.bilibili.com${path}?${qs}`, { headers })
}

export const getVideoInfo = async(bvid) => {
  if (!bvid) throw new Error('缺少视频 ID')
  if (videoCache.has(bvid)) return videoCache.get(bvid)
  const { body } = await requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`)
  if (body?.code !== 0 || !body.data) throw new Error(body?.message || '获取视频信息失败')
  const data = body.data
  const info = {
    bvid: data.bvid || bvid,
    aid: data.aid,
    cid: data.cid || data.pages?.[0]?.cid,
    title: data.title || '',
    pic: normalizePic(data.pic),
    owner: data.owner?.name || '',
    duration: Number(data.duration) || 0,
  }
  if (!info.cid) throw new Error('获取视频音频信息失败')
  videoCache.set(bvid, info)
  return info
}

const pickAudio = (dash, quality) => {
  const list = []
  for (const item of dash?.audio || []) {
    if (item?.baseUrl) list.push(item)
  }
  if (dash?.flac?.audio?.baseUrl) list.push({ ...dash.flac.audio, flac: true })
  if (!list.length) throw new Error('没有可播放的音频')
  list.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))
  if (quality == 'flac') {
    const flac = list.find(item => item.flac || String(item.codecs || '').includes('flac'))
    if (flac) return { type: 'flac', url: flac.baseUrl }
  }
  if (quality == '128k') {
    const low = [...list].reverse().find(item => !item.flac) || list[list.length - 1]
    return { type: '128k', url: low.baseUrl }
  }
  const best = list.find(item => !item.flac) || list[0]
  return { type: '320k', url: best.baseUrl }
}

export const getAudioUrl = async(bvid, cid, quality) => {
  const { body } = await signedGet('/x/player/wbi/playurl', {
    bvid,
    cid,
    qn: quality == '128k' ? 64 : 127,
    fnver: 0,
    fnval: 16,
    fourk: 1,
  }, {
    Referer: `https://www.bilibili.com/video/${bvid}`,
  })
  if (body?.code !== 0) throw new Error(body?.message || '获取音频失败')
  return pickAudio(body.data?.dash, quality)
}
