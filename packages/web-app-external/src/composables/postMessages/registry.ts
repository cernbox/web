import { computed, ref, unref, type Ref } from 'vue'
import type {
  OfficePostMessageContext,
  OfficePostMessageFactory,
  OfficePostMessageRegistration
} from './types'
import { useCollaboraPostMessages } from './useCollaboraPostMessages'
import { useEuroOfficePostMessages } from './useEuroOfficePostMessages'
import { useMS365PostMessages } from './useMS365PostMessages'

export interface OfficePostMessageRegistryEntry {
  match: (appName: string) => boolean
  factory: OfficePostMessageFactory
}

/**
 * Which app-specific composable handles postMessages for a given app name.
 */
export const registrations: OfficePostMessageRegistryEntry[] = [
  {
    match: (appName) => appName?.toLowerCase().startsWith('collabora'),
    factory: useCollaboraPostMessages
  },
  {
    // EuroOffice is an OnlyOffice derivative and speaks the same postMessage dialect, so a
    // provider reporting either name gets these handlers - without this an "OnlyOffice"
    // provider would silently end up with no handler at all
    match: (appName) =>
      ['eurooffice', 'onlyoffice'].some((name) => appName?.toLowerCase().startsWith(name)),
    factory: useEuroOfficePostMessages
  },
  {
    match: (appName) => appName?.toLowerCase() === 'ms365',
    factory: useMS365PostMessages
  }
]

export function useOfficePostMessageRegistry(appName: Ref<string>, ctx: OfficePostMessageContext) {
  const active = ref<OfficePostMessageRegistration | null>(null)

  const register = () => {
    const entry = registrations.find((r) => r.match(unref(appName)))
    active.value = entry ? entry.factory(ctx) : null
  }

  const unregister = () => {
    unref(active)?.onUnmount?.()
    active.value = null
  }

  const handleMessage = (event: MessageEvent) => {
    unref(active)?.handlePostMessage(event)
  }

  const notifyResourceChanged = () => {
    unref(active)?.onResourceChanged?.()
  }

  const isAppLoaded = computed(() => {
    const handler = unref(active)
    return handler?.isLoaded ? unref(handler.isLoaded) : false
  })

  const hasPendingMentions = computed(() => {
    const handler = unref(active)
    return handler?.hasPendingMentions ? unref(handler.hasPendingMentions) : false
  })

  return {
    register,
    unregister,
    handleMessage,
    notifyResourceChanged,
    isAppLoaded,
    hasPendingMentions
  }
}
