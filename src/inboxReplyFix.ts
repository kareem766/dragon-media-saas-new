const enableHumanInboxReply = () => {
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea')

  textareas.forEach(textarea => {
    const isHumanMode = textarea.placeholder.includes('Ryan متوقف')
    if (!isHumanMode) return

    if (textarea.disabled) {
      textarea.disabled = false
    }

    const form = textarea.form
    if (!form) return

    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!submitButton) return

    if (textarea.value.trim()) {
      submitButton.disabled = false
    }
  })
}

if (typeof document !== 'undefined') {
  const observer = new MutationObserver(enableHumanInboxReply)

  const start = () => {
    enableHumanInboxReply()
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled', 'placeholder'],
    })
  }

  if (document.body) {
    start()
  } else {
    window.addEventListener('DOMContentLoaded', start, { once: true })
  }

  document.addEventListener('input', enableHumanInboxReply, true)
}
