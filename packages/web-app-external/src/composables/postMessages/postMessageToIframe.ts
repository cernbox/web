import { unref, type Ref } from 'vue'

export function postMessageToIframe(
  appIframeRef: Ref<HTMLIFrameElement | null>,
  messageId: string,
  values?: Record<string, unknown>
): void {
  const iframe = unref(appIframeRef)
  if (!iframe?.contentWindow) {
    console.error('office app iframe not found, cannot post message', messageId)
    return
  }
  iframe.contentWindow.postMessage(
    JSON.stringify({
      MessageId: messageId,
      SendTime: Date.now(),
      ...(values && { Values: values })
    }),
    '*'
  )
}
