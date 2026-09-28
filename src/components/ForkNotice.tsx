import { memo } from 'react'
import Text from '@/components/common/Text'
import { createStyle, openUrl } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

const OFFICIAL = 'https://github.com/lyswhut/lx-music-mobile'
const AUTHOR = 'https://github.com/Call-me-Eric'
const README = 'https://github.com/Call-me-Eric/lx-music-mobile#readme'
const ISSUES = 'https://github.com/Call-me-Eric/lx-music-mobile/issues'

export default memo(({ selectable }: { selectable?: boolean }) => {
  const theme = useTheme()
  const linkStyle = {
    ...styles.text,
    textDecorationLine: 'underline' as const,
    color: theme['c-primary-font'],
  }
  const open = (url: string) => () => {
    void openUrl(url)
  }

  return (
    <Text selectable={selectable} style={styles.text}>
      注意：你当前使用的并非
      <Text selectable={selectable} onPress={open(OFFICIAL)} style={linkStyle}>lyswhut</Text>
      发布的官方版本，而是
      <Text selectable={selectable} onPress={open(AUTHOR)} style={linkStyle}>Call_me_Eric</Text>
      基于官方代码增加功能后构建的第三方修改版。具体改了什么，可以查看
      <Text selectable={selectable} onPress={open(README)} style={linkStyle}>本仓库的 README</Text>
      。本版本不保证运行稳定。如果遇到问题，它不一定也出现在官方版本上，因此提交到官方仓库的 Issue 可能不会被接受。建议改在
      <Text selectable={selectable} onPress={open(ISSUES)} style={linkStyle}>本 fork 仓库</Text>
      中反馈。
    </Text>
  )
})

const styles = createStyle({
  text: {
    fontSize: 14,
    textAlignVertical: 'bottom',
  },
})
