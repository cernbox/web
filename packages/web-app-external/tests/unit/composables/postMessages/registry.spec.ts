import { ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  registrations,
  useOfficePostMessageRegistry
} from '../../../../src/composables/postMessages/registry'
import { OfficePostMessageRegistration } from '../../../../src/composables/postMessages/types'

describe('useOfficePostMessageRegistry', () => {
  const realRegistrations = [...registrations]

  afterEach(() => {
    registrations.length = 0
    registrations.push(...realRegistrations)
  })

  const getContext = () => ({
    space: ref(mock<SpaceResource>()),
    resource: ref(mock<Resource>()),
    appIframeRef: ref(null)
  })

  it('has a real matcher for Collabora app names', () => {
    expect(realRegistrations.some((r) => r.match('Collabora'))).toBe(true)
    expect(realRegistrations.some((r) => r.match('collabora-something'))).toBe(true)
  })

  it('has a real matcher for EuroOffice app names', () => {
    expect(realRegistrations.some((r) => r.match('EuroOffice'))).toBe(true)
    expect(realRegistrations.some((r) => r.match('EuroOffice Writer'))).toBe(true)
  })

  it('has a real matcher for MS365, exclusive to that app name', () => {
    const ms365Entry = realRegistrations.find((r) => r.match('MS365'))
    expect(ms365Entry).toBeTruthy()
    expect(ms365Entry.match('Collabora')).toBe(false)
    expect(ms365Entry.match('EuroOffice')).toBe(false)
  })

  it('does not register a handler when no entry matches the app name', () => {
    const appName = ref('SomeUnknownApp')
    const { register, handleMessage, notifyResourceChanged, unregister } =
      useOfficePostMessageRegistry(appName, getContext())

    register()

    // none of these should throw when there is no active handler
    handleMessage(mock<MessageEvent>())
    notifyResourceChanged()
    unregister()
  })

  it('registers, delegates messages to, and tears down the matching handler', () => {
    const handlePostMessage = vi.fn()
    const onResourceChanged = vi.fn()
    const onUnmount = vi.fn()
    const factory = vi.fn(
      (): OfficePostMessageRegistration => ({
        handlePostMessage,
        onResourceChanged,
        onUnmount
      })
    )

    registrations.length = 0
    registrations.push({
      match: (appName) => appName?.toLowerCase() === 'collabora',
      factory
    })

    const appName = ref('Collabora')
    const ctx = getContext()
    const { register, handleMessage, notifyResourceChanged, unregister } =
      useOfficePostMessageRegistry(appName, ctx)

    register()
    expect(factory).toHaveBeenCalledWith(ctx)

    const event = mock<MessageEvent>()
    handleMessage(event)
    expect(handlePostMessage).toHaveBeenCalledWith(event)

    notifyResourceChanged()
    expect(onResourceChanged).toHaveBeenCalled()

    unregister()
    expect(onUnmount).toHaveBeenCalled()

    // after unregister, the handler is detached
    handleMessage(event)
    expect(handlePostMessage).toHaveBeenCalledTimes(1)
  })

  it('reports hasPendingMentions as false when the active handler does not implement it', () => {
    const factory = vi.fn((): OfficePostMessageRegistration => ({ handlePostMessage: vi.fn() }))
    registrations.length = 0
    registrations.push({
      match: (appName) => appName?.toLowerCase() === 'collabora',
      factory
    })

    const appName = ref('Collabora')
    const { register, hasPendingMentions } = useOfficePostMessageRegistry(appName, getContext())

    register()

    expect(hasPendingMentions.value).toBe(false)
  })

  it("reflects the active handler's hasPendingMentions", () => {
    const pendingMentions = ref(false)
    const factory = vi.fn(
      (): OfficePostMessageRegistration => ({
        handlePostMessage: vi.fn(),
        hasPendingMentions: pendingMentions
      })
    )
    registrations.length = 0
    registrations.push({
      match: (appName) => appName?.toLowerCase() === 'collabora',
      factory
    })

    const appName = ref('Collabora')
    const { register, hasPendingMentions } = useOfficePostMessageRegistry(appName, getContext())

    register()
    expect(hasPendingMentions.value).toBe(false)

    pendingMentions.value = true
    expect(hasPendingMentions.value).toBe(true)
  })

  it('does not match a differently-named app', () => {
    const factory = vi.fn((): OfficePostMessageRegistration => ({ handlePostMessage: vi.fn() }))
    registrations.length = 0
    registrations.push({
      match: (appName) => appName?.toLowerCase() === 'collabora',
      factory
    })

    const appName = ref('EuroOffice')
    const { register } = useOfficePostMessageRegistry(appName, getContext())

    register()
    expect(factory).not.toHaveBeenCalled()
  })
})
