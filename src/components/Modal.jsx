import { useEffect, useRef } from 'react'

const focusable =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'

export default function Modal({
  as: Element = 'section',
  onClose,
  children,
  ...props
}) {
  const ref = useRef(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const node = ref.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    const siblings = []
    for (
      let branch = node;
      branch.parentElement;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && !sibling.inert) {
          sibling.inert = true
          siblings.push(sibling)
        }
      }
      if (branch.parentElement === document.body) break
    }
    document.body.style.overflow = 'hidden'
    const controls = () =>
      [...node.querySelectorAll(focusable)].filter(
        (item) =>
          !item.closest('[hidden]') &&
          getComputedStyle(item).display !== 'none',
      )
    ;(controls()[0] || node).focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current?.()
      }
      if (event.key === 'Tab') {
        const items = controls()
        const first = items[0] || node
        const last = items.at(-1) || node
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          event.preventDefault()
          last.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      siblings.forEach((item) => {
        item.inert = false
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return (
    <Element {...props} ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
      {children}
    </Element>
  )
}
