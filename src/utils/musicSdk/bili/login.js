import { httpFetch } from '../../request'
import { getAccount, getBiliPlayHeaders, loadAccount, logoutAccount, parseCookieHeader, parseCookieString, saveAccount } from './account'
import { requestJson } from './api'

const wait = (ms) => new Promise(resolve => { setTimeout(resolve, ms) })

export const verifyAndSaveLogin = async(cookies) => {
  const previous = getAccount()
  await saveAccount({ cookies, uname: '', mid: '', face: '' })
  try {
    const { body } = await requestJson('https://api.bilibili.com/x/web-interface/nav')
    if (body?.code !== 0 || !body.data?.isLogin) throw new Error(body?.message || '登录状态无效')
    return await saveAccount({
      cookies,
      uname: body.data.uname || '',
      mid: body.data.mid != null ? String(body.data.mid) : '',
      face: body.data.face || '',
    })
  } catch (err) {
    if (previous?.cookies?.SESSDATA) await saveAccount(previous)
    else await logoutAccount()
    throw err
  }
}

export const loginWithCookie = async(raw) => {
  await loadAccount()
  const cookies = parseCookieString(raw)
  if (!cookies.SESSDATA) throw new Error('缺少 SESSDATA')
  return verifyAndSaveLogin(cookies)
}

export const createQrLogin = () => {
  let stopped = false
  let requestObj = null
  const start = async(onStatus) => {
    await loadAccount()
    const generated = await httpFetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
      headers: getBiliPlayHeaders(),
    }).promise
    if (stopped) return
    if (generated.body?.code !== 0 || !generated.body?.data?.url) throw new Error(generated.body?.message || '获取二维码失败')
    const { url, qrcode_key: qrcodeKey } = generated.body.data
    onStatus({ status: 'waiting', url })
    while (!stopped) {
      await wait(1500)
      if (stopped) return
      requestObj = httpFetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`, {
        headers: getBiliPlayHeaders(),
      })
      const resp = await requestObj.promise
      if (stopped) return
      const dataCode = resp.body?.data?.code
      if (dataCode == 86101) onStatus({ status: 'waiting', url })
      else if (dataCode == 86090) onStatus({ status: 'scanned', url })
      else if (dataCode == 86038) {
        onStatus({ status: 'expired', url })
        return
      } else if (dataCode == 0) {
        const cookies = parseCookieHeader(resp.headers)
        if (!cookies.SESSDATA) {
          onStatus({ status: 'need_cookie', url })
          return
        }
        const account = await verifyAndSaveLogin(cookies)
        onStatus({ status: 'success', account })
        return
      } else {
        onStatus({ status: 'error', message: resp.body?.message || resp.body?.data?.message || '登录失败' })
        return
      }
    }
  }
  return {
    start,
    stop() {
      stopped = true
      requestObj?.cancelHttp()
    },
  }
}
