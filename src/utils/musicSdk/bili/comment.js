import { dateFormat2 } from '../../index'
import { biliRequest, getVideoInfo } from './api'

const cursors = new Map()

const mapComment = (item) => ({
  id: String(item.rpid),
  text: item.content?.message || '',
  time: item.ctime,
  timeStr: item.ctime ? dateFormat2(Number(item.ctime) * 1000) : '',
  userName: item.member?.uname || '',
  avatar: item.member?.avatar || '',
  userId: item.member?.mid != null ? String(item.member.mid) : '',
  likedCount: item.like || 0,
  images: Array.isArray(item.content?.pictures) ? item.content.pictures.map(pic => pic.img_src).filter(Boolean) : [],
  reply: Array.isArray(item.replies) ? item.replies.map(mapComment) : [],
})

const rememberCursor = (key, page, next) => {
  const pages = cursors.get(key) || { 1: 0 }
  pages[1] = 0
  pages[page + 1] = next
  cursors.set(key, pages)
  return pages
}

export default {
  _requestObj: null,
  _requestObj2: null,
  async resolveAid(songInfo) {
    if (songInfo.albumId) return songInfo.albumId
    const info = await getVideoInfo(songInfo.songmid)
    return info.aid
  },
  async fetchComments(songInfo, page, mode) {
    const aid = await this.resolveAid(songInfo)
    const key = `${aid}_${mode}`
    if (page <= 1) cursors.set(key, { 1: 0 })
    const pages = cursors.get(key)
    const next = page <= 1 ? 0 : pages?.[page]
    if (page > 1 && next == null) throw new Error('请按顺序加载评论')
    const requestObj = biliRequest(`https://api.bilibili.com/x/v2/reply/main?type=1&oid=${aid}&mode=${mode}&next=${next ?? 0}`)
    if (mode == 2) this._requestObj = requestObj
    else this._requestObj2 = requestObj
    const { body, statusCode } = await requestObj.promise
    if (statusCode != 200 || body?.code !== 0) throw new Error(body?.message || '获取评论失败')
    const cursor = body.data?.cursor || {}
    rememberCursor(key, page, cursor.next || 0)
    const comments = Array.isArray(body.data?.replies) ? body.data.replies.map(mapComment) : []
    const total = Number(cursor.all_count) || comments.length
    const pageSize = comments.length || 20
    const maxPage = cursor.is_end ? page : Math.max(page + 1, Math.ceil(total / pageSize) || 1)
    return {
      source: 'bili',
      comments,
      total,
      page,
      limit: pageSize,
      maxPage,
    }
  },
  async getComment(songInfo, page = 1) {
    if (this._requestObj) this._requestObj.cancelHttp()
    return this.fetchComments(songInfo, page, 2)
  },
  async getHotComment(songInfo, page = 1) {
    if (this._requestObj2) this._requestObj2.cancelHttp()
    return this.fetchComments(songInfo, page, 3)
  },
}
