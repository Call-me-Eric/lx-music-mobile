import { memo, useEffect, useRef, useState } from 'react'
import { Image, TextInput, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { loadAccount, logoutAccount } from '@/utils/musicSdk/bili/account'
import { createQrLogin, loginWithCookie } from '@/utils/musicSdk/bili/login'
import qrcode from '@/utils/qrcode'

interface Profile {
  uname: string
  mid: string
}

type QrStatus = 'loading' | 'waiting' | 'scanned' | 'expired' | 'need_cookie' | 'error' | 'success'

const toProfile = (account: { uname?: string, mid?: string, cookies?: { SESSDATA?: string } } | null): Profile | null => {
  if (!account?.cookies?.SESSDATA) return null
  return { uname: account.uname || account.mid || '', mid: account.mid || '' }
}

const makeQr = (url: string) => {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  return qr.createDataURL(8, 8)
}

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const dialogRef = useRef<DialogType>(null)
  const sessionRef = useRef<ReturnType<typeof createQrLogin> | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [qrUri, setQrUri] = useState('')
  const [status, setStatus] = useState<QrStatus>('loading')
  const [message, setMessage] = useState('')
  const [cookie, setCookie] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadAccount().then(account => { setProfile(toProfile(account)) })
    return () => {
      sessionRef.current?.stop()
    }
  }, [])

  const stopLogin = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
  }

  const startLogin = () => {
    stopLogin()
    const session = createQrLogin()
    sessionRef.current = session
    setQrUri('')
    setMessage('')
    setStatus('loading')
    void session.start((info: {
      status: QrStatus
      url?: string
      message?: string
      account?: { uname?: string, mid?: string, cookies?: { SESSDATA?: string } }
    }) => {
      if (sessionRef.current != session) return
      if (info.url) setQrUri(makeQr(info.url))
      setStatus(info.status)
      if (info.message) setMessage(info.message)
      if (info.status == 'success' && info.account) {
        setProfile(toProfile(info.account))
        toast(t('setting_bili_qr_success'))
        dialogRef.current?.setVisible(false)
      }
    }).catch((err: Error) => {
      if (sessionRef.current != session) return
      setStatus('error')
      setMessage(err.message)
    })
  }

  const openLogin = () => {
    dialogRef.current?.setVisible(true)
    startLogin()
  }

  const handleHide = () => {
    stopLogin()
  }

  const handleLogout = () => {
    void logoutAccount().then(() => {
      setProfile(null)
      toast(t('setting_bili_logout_success'))
    })
  }

  const handleSaveCookie = () => {
    if (saving) return
    setSaving(true)
    void loginWithCookie(cookie).then(account => {
      setProfile(toProfile(account))
      setCookie('')
      toast(t('setting_bili_qr_success'))
      dialogRef.current?.setVisible(false)
    }).catch((err: Error) => {
      toast(err.message)
    }).finally(() => {
      setSaving(false)
    })
  }

  const statusText = status == 'scanned'
    ? t('setting_bili_qr_scanned')
    : status == 'expired'
      ? t('setting_bili_qr_expired')
      : status == 'need_cookie'
        ? t('setting_bili_qr_need_cookie')
        : status == 'error'
          ? message || t('setting_bili_qr_need_cookie')
          : status == 'waiting'
            ? t('setting_bili_qr_waiting')
            : t('setting_bili_qr_tip')

  return (
    <>
      <SubTitle title={t('setting_bili_account')}>
        <Text style={styles.tip} size={12} color={theme['c-500']}>{t('setting_bili_account_tip')}</Text>
        <Text style={styles.status} size={13}>
          {profile ? t('setting_bili_status_login', { name: profile.uname || profile.mid }) : t('setting_bili_status_logout')}
        </Text>
        <View style={styles.btns}>
          <Button onPress={openLogin}>{t('setting_bili_login')}</Button>
          {profile ? <Button onPress={handleLogout}>{t('setting_bili_logout')}</Button> : null}
        </View>
      </SubTitle>
      <Dialog ref={dialogRef} title={t('setting_bili_qr_title')} onHide={handleHide} bgHide={false}>
        <View style={styles.dialog}>
          <Text size={13} color={theme['c-500']}>{statusText}</Text>
          {qrUri
            ? <Image source={{ uri: qrUri }} style={styles.qr} />
            : <View style={{ ...styles.qr, backgroundColor: theme['c-250'] }} />
          }
          {status == 'expired' || status == 'error' ? <Button onPress={startLogin}>{t('setting_bili_qr_refresh')}</Button> : null}
          <TextInput
            value={cookie}
            onChangeText={setCookie}
            placeholder={t('setting_bili_cookie_placeholder')}
            placeholderTextColor={theme['c-400']}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={{ ...styles.input, color: theme['c-font'], borderColor: theme['c-300'] }}
          />
          <Button disabled={!cookie.trim() || saving} onPress={handleSaveCookie}>{t('setting_bili_cookie_save')}</Button>
        </View>
      </Dialog>
    </>
  )
})

const styles = createStyle({
  tip: {
    marginBottom: 8,
    paddingRight: 15,
  },
  status: {
    marginBottom: 8,
  },
  btns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dialog: {
    padding: 16,
    alignItems: 'center',
  },
  qr: {
    width: 220,
    height: 220,
    marginTop: 12,
    marginBottom: 12,
  },
  input: {
    width: '100%',
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginTop: 12,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
})
