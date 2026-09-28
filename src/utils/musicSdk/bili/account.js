import { getData, saveData, removeData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const COOKIE_NAMES = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid', 'buvid3', 'bili_ticket']

let account = null
let loaded = false
let loading = null

const randomId = () => 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  const v = c == 'x' ? r : (r & 0x3 | 0x8)
  return v.toString(16)
})

const emptyAccount = () => ({
  cookies: {},
  uname: '',
  mid: '',
  face: '',
})

export const buildCookie = (info = account) => {
  const cookies = info?.cookies
  if (!cookies) return ''
  return COOKIE_NAMES.filter(name => cookies[name]).map(name => `${name}=${cookies[name]}`).join('; ')
}

export const getBiliPlayHeaders = () => {
  const headers = {
    Referer: 'https://www.bilibili.com',
    Origin: 'https://www.bilibili.com',
    'User-Agent': UA,
  }
  const cookie = buildCookie()
  if (cookie) headers.Cookie = cookie
  return headers
}

export const getAccount = () => account

export const isBiliLoggedIn = () => Boolean(account?.cookies?.SESSDATA)

const emitAccountUpdated = () => {
  global.state_event?.biliAccountUpdated?.()
}

export const loadAccount = async() => {
  if (loaded) return account
  if (loading) return loading
  loading = getData(storageDataPrefix.biliAccount).then(async data => {
    account = data && typeof data == 'object' ? { ...emptyAccount(), ...data, cookies: { ...(data.cookies || {}) } } : emptyAccount()
    if (!account.cookies.buvid3) {
      account.cookies.buvid3 = `${randomId()}infoc`
      await saveData(storageDataPrefix.biliAccount, account)
    }
    loaded = true
    emitAccountUpdated()
    return account
  }).finally(() => {
    loading = null
  })
  return loading
}

export const saveAccount = async(next) => {
  account = {
    ...emptyAccount(),
    ...next,
    cookies: { ...(account?.cookies || {}), ...(next?.cookies || {}) },
  }
  loaded = true
  await saveData(storageDataPrefix.biliAccount, account)
  emitAccountUpdated()
  return account
}

export const logoutAccount = async() => {
  const buvid3 = account?.cookies?.buvid3
  account = emptyAccount()
  if (buvid3) account.cookies.buvid3 = buvid3
  loaded = true
  if (buvid3) await saveData(storageDataPrefix.biliAccount, account)
  else await removeData(storageDataPrefix.biliAccount)
  emitAccountUpdated()
  return account
}

export const parseCookieHeader = (headers) => {
  const cookies = {}
  if (!headers) return cookies
  const chunks = []
  const raw = headers['set-cookie'] || headers['Set-Cookie']
  if (Array.isArray(raw)) chunks.push(...raw)
  else if (raw) chunks.push(String(raw))
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() == 'set-cookie' && value && !chunks.includes(value)) {
      if (Array.isArray(value)) chunks.push(...value)
      else chunks.push(String(value))
    }
  }
  const text = chunks.join('\n')
  for (const name of COOKIE_NAMES) {
    const matched = new RegExp(`(?:^|[\\n;,\\s])${name}=([^;\\s]+)`).exec(text)
    if (matched) cookies[name] = matched[1]
  }
  return cookies
}

export const parseCookieString = (raw) => {
  const cookies = {}
  const text = String(raw || '')
  for (const name of COOKIE_NAMES) {
    const matched = new RegExp(`(?:^|[\\n;,\\s])${name}=([^;\\s]+)`).exec(text)
    if (matched) cookies[name] = matched[1]
  }
  return cookies
}

export { UA }
