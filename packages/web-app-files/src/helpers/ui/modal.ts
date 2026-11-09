/**
 * Use as `@keydown.esc` on the content of a modal that has menus or selects.
 *
 * The menus and the select options are inside the modal, so without this one Escape
 * closes them and the whole modal. Stopping the event also keeps it from tippy, which
 * listens on the document, so the open menu is closed here.
 */
export const closeMenuOnEscape = (event: KeyboardEvent) => {
  const content = event.currentTarget as HTMLElement
  const menu = content.querySelector<HTMLElement & { _tippy?: { hide(): void } }>(
    '[data-tippy-root]'
  )
  if (!menu && !content.querySelector('.vs--open')) {
    return
  }
  event.stopPropagation()
  menu?._tippy?.hide()
}

/**
 * Use as `@focusout` on the content of a modal. A button that gets disabled while it saves,
 * or a menu that closes, drops the focus to the page, and then Escape and the keyboard no
 * longer reach the modal. So the focus goes back to the modal.
 */
export const keepFocusInModal = (event: FocusEvent) => {
  if (event.relatedTarget) {
    return
  }
  const modal = (event.currentTarget as HTMLElement).closest<HTMLElement>('.oc-modal')
  setTimeout(() => {
    if (
      modal?.isConnected &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      modal.focus()
    }
  })
}
