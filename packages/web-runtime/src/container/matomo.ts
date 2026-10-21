import { initMatomo, MatomoTracker } from '@certible/use-matomo'
import {
  AppsStore,
  AuthStore,
  ConfigStore,
  createLocationTrash,
  eventBus,
  MatomoEvent,
  matomoEvents,
  MessageStore,
  SideBarEventTopics,
  SpacesStore,
  UppyResource,
  UserStore
} from '@ownclouders/web-pkg'
import {
  isMountPointSpaceResource,
  isPersonalSpaceResource,
  isProjectSpaceResource,
  isPublicSpaceResource,
  isShareSpaceResource,
  Resource,
  SpaceResource
} from '@ownclouders/web-client'
import { watch } from 'vue'
import { RouteLocationNormalized, Router } from 'vue-router'

/**
 * Rewrites every request right before matomo sends it:
 * - `url` is reduced to its origin, because paths can contain file, folder and space names
 * - `urlref` (the referrer) is removed, because it holds the full url of the previous page.
 *   Only the first hit in embed mode keeps one, set to https://embedded/, so visits that
 *   started embedded can still be counted without knowing the embedding page.
 *
 * It is on by default and can be turned off with `matomo.stripUrls: false`.
 */
const createRequestProcessor = ({ configStore }: { configStore: ConfigStore }) => {
  let firstHitSent = false

  return (request: string): string => {
    try {
      const params = new URLSearchParams(request)
      if (params.get('url')) {
        params.set('url', new URL(params.get('url')).origin + '/')
      }

      if (!firstHitSent && configStore.options.embed?.enabled) {
        params.set('urlref', 'https://embedded/')
      } else {
        params.delete('urlref')
      }
      firstHitSent = true

      return params.toString()
    } catch {
      return request
    }
  }
}

const getExtension = (fileName: string): string => {
  return fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'None'
}

const trackPageAccess = ({
  tracker,
  appsStore,
  pages,
  trackApps,
  to,
  from
}: {
  tracker: MatomoTracker
  appsStore: AppsStore
  pages: Record<string, string>
  trackApps: boolean
  to: RouteLocationNormalized
  from: RouteLocationNormalized
}): void => {
  if (to.name === from.name) {
    return
  }

  const fileApp = appsStore.fileExtensions.find((e) => (e.routeName || e.app) === to.name)
  if (fileApp) {
    if (trackApps) {
      const file = String(to.params.driveAliasAndItem || '')
      tracker.trackEvent('App', fileApp.app, getExtension(file))
    }
    return
  }

  const page = pages[String(to.name)]
  if (page) {
    tracker.trackEvent(page, String(to.name))
  }
}

const trackUploads = ({ tracker }: { tracker: MatomoTracker }): void => {
  eventBus.subscribe('uploadSuccess', (file: UppyResource) => {
    tracker.trackEvent('Upload', 'File', getExtension(file.name))
  })
}

const trackDownloads = ({ tracker }: { tracker: MatomoTracker }): void => {
  eventBus.subscribe(
    'app.files.downloaded',
    ({ resource, version }: { resource: Resource; version?: string }) => {
      tracker.trackEvent('Download', version ? 'File Version' : 'File', getExtension(resource.name))
    }
  )
  eventBus.subscribe('app.files.archive.downloaded', () => {
    tracker.trackEvent('Download', 'Folder/Archive')
  })
}

const trackVersionsPanel = ({ tracker }: { tracker: MatomoTracker }): void => {
  const onPanel = (panelName: string) => {
    if (panelName === 'versions') {
      tracker.trackEvent('Versions', 'Opened Panel')
    }
  }

  eventBus.subscribe(SideBarEventTopics.openWithPanel, onPanel)
  eventBus.subscribe(SideBarEventTopics.setActivePanel, onPanel)
}

const trackVersionRestores = ({ tracker }: { tracker: MatomoTracker }): void => {
  eventBus.subscribe('app.files.versions.restored', () => {
    tracker.trackEvent('Versions', 'Restore', undefined, 1)
  })
}

const trackSearches = ({ tracker }: { tracker: MatomoTracker }): void => {
  eventBus.subscribe('app.search.performed', () => {
    tracker.trackEvent('Search', 'Searched')
  })
}

const trackProjectAccess = ({
  tracker,
  currentSpace,
  previousSpace
}: {
  tracker: MatomoTracker
  currentSpace: SpaceResource
  previousSpace: SpaceResource
}): void => {
  if (!isProjectSpaceResource(currentSpace) || currentSpace.id === previousSpace?.id) {
    return
  }

  tracker.trackEvent('Project', currentSpace.name)
}

const trackSharedContentAccess = ({
  tracker,
  currentSpace,
  previousSpace
}: {
  tracker: MatomoTracker
  currentSpace: SpaceResource
  previousSpace: SpaceResource
}): void => {
  if (!currentSpace || currentSpace.id === previousSpace?.id) {
    return
  }

  if (isShareSpaceResource(currentSpace) || isMountPointSpaceResource(currentSpace)) {
    tracker.trackEvent('Shares', 'Opened User Share')
  } else if (isPublicSpaceResource(currentSpace)) {
    tracker.trackEvent('Shares', 'Opened Public Link')
  }
}

const trackTrashBinAccess = ({
  tracker,
  currentSpace,
  previousSpace
}: {
  tracker: MatomoTracker
  currentSpace: SpaceResource
  previousSpace: SpaceResource
}): void => {
  if (!currentSpace || currentSpace.id === previousSpace?.id) {
    return
  }

  if (isPersonalSpaceResource(currentSpace)) {
    tracker.trackEvent('Trash Bin', 'Opened Personal')
  } else if (isProjectSpaceResource(currentSpace)) {
    tracker.trackEvent('Trash Bin', 'Opened Project')
  }
}

const trackTrashBinRestores = ({
  tracker,
  spacesStore
}: {
  tracker: MatomoTracker
  spacesStore: SpacesStore
}): void => {
  eventBus.subscribe('app.files.trash.restored', ({ count }: { count: number }) => {
    const type = isProjectSpaceResource(spacesStore.currentSpace) ? 'Project' : 'Personal'
    tracker.trackEvent('Trash Bin', 'Restore', type, count)
  })
}

// some HttpErrors (e.g. from the archiver) only carry the status in their response
type ErrorWithStatus = {
  statusCode?: number
  response?: { status?: number }
}

const getErrorStatus = (error: ErrorWithStatus): string => {
  const status = error?.statusCode || error?.response?.status
  return status ? String(status) : 'None'
}

const trackErrors = ({
  tracker,
  messagesStore,
  router
}: {
  tracker: MatomoTracker
  messagesStore: MessageStore
  router: Router
}): void => {
  messagesStore.$onAction(({ name, args }) => {
    if (name !== 'showErrorMessage') {
      return
    }

    const [{ errors = [] }] = args as Parameters<MessageStore['showErrorMessage']>
    const status = getErrorStatus(errors[0] as ErrorWithStatus)
    tracker.trackEvent('Error', String(router.currentRoute.value.name), status)
  })
}

const trackUser = ({
  tracker,
  authStore,
  userStore
}: {
  tracker: MatomoTracker
  authStore: AuthStore
  userStore: UserStore
}): void => {
  watch(
    () => authStore.userContextReady,
    (userContextReady) => {
      if (!userContextReady) {
        return
      }

      tracker.setUserId(userStore.user.id)
    },
    { immediate: true }
  )
}

/**
 * starts the matomo tracker
 *
 * @param configStore
 * @param router
 * @param appsStore
 */
export const startMatomo = ({
  configStore,
  router,
  appsStore,
  spacesStore,
  authStore,
  userStore,
  messagesStore
}: {
  configStore: ConfigStore
  router: Router
  appsStore: AppsStore
  spacesStore: SpacesStore
  authStore: AuthStore
  userStore: UserStore
  messagesStore: MessageStore
}): void => {
  const {
    host,
    siteId,
    domains = [],
    stripUrls = true,
    events = matomoEvents,
    pages = {}
  } = configStore.matomo || {}
  if (!host || !siteId) {
    return
  }

  const isEnabled = (event: MatomoEvent) => events.includes(event)

  const tracker = initMatomo({
    host,
    siteId,
    domains,
    trackRouter: true,
    enableLinkTracking: false,
    preInitActions: stripUrls
      ? [['setCustomRequestProcessing', createRequestProcessor({ configStore })]]
      : []
  })

  // metrics that rely only on the route
  watch(router.currentRoute, (to, from) => {
    trackPageAccess({ tracker, appsStore, pages, trackApps: isEnabled('app'), to, from })
  })

  // metrics that rely on the space
  let previousSpace: SpaceResource
  let previousTrashSpace: SpaceResource
  watch(
    () => spacesStore.currentSpace,
    (currentSpace) => {
      const trashSpaceRouteName = createLocationTrash('files-trash-generic').name

      // the trash bin of a space is resolved like a folder of that space, so it is kept apart:
      // opening a project's trash bin must not count as accessing the project
      if (router.currentRoute.value.name === trashSpaceRouteName) {
        if (isEnabled('trash')) {
          trackTrashBinAccess({ tracker, currentSpace, previousSpace: previousTrashSpace })
        }
        previousTrashSpace = currentSpace
        return
      }

      if (isEnabled('project')) {
        trackProjectAccess({ tracker, currentSpace, previousSpace })
      }
      if (isEnabled('shares')) {
        trackSharedContentAccess({ tracker, currentSpace, previousSpace })
      }
      previousSpace = currentSpace
      previousTrashSpace = undefined
    }
  )

  // metrics that do not rely on a state change
  if (isEnabled('userId')) {
    trackUser({ tracker, authStore, userStore })
  }
  if (isEnabled('upload')) {
    trackUploads({ tracker })
  }
  if (isEnabled('download')) {
    trackDownloads({ tracker })
  }
  if (isEnabled('versions')) {
    trackVersionsPanel({ tracker })
    trackVersionRestores({ tracker })
  }
  if (isEnabled('trash')) {
    trackTrashBinRestores({ tracker, spacesStore })
  }
  if (isEnabled('search')) {
    trackSearches({ tracker })
  }
  if (isEnabled('error')) {
    trackErrors({ tracker, messagesStore, router })
  }
}
