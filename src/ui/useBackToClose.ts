import { useEffect, useRef } from 'react'

// Android's Back button (and the browser's) closes the open page instead of leaving the app.
// One history entry stands for "something is open". Changes are settled on the next tick, so a page that
// closes while another opens in the same moment does not pop the newcomer's entry.
const open: Array<() => void> = []
let pushed = false

function settle() {
  setTimeout(() => {
    if (open.length > 0 && !pushed) {
      history.pushState({ overlay: true }, '')
      pushed = true
    } else if (open.length === 0 && pushed) {
      pushed = false // cleared first, so the pop this causes is recognised as ours
      history.back()
    }
  }, 0)
}

window.addEventListener('popstate', () => {
  if (!pushed) return
  pushed = false
  open[open.length - 1]?.()
})

export function useBackToClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!isOpen) return
    const close = () => onCloseRef.current()
    open.push(close)
    settle()
    return () => {
      open.splice(open.indexOf(close), 1)
      settle()
    }
  }, [isOpen])
}
