import { initMatomo, MatomoTracker } from '@certible/use-matomo'
import {
  AppsStore,
  AuthStore,
  ConfigStore,
  createLocationTrash,
  eventBus,
  locationSharesViaLink,
  locationSharesWithMe,
  locationSharesWithOthers,
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
  SpaceResource
} from '@ownclouders/web-client'
import { watch } from 'vue'
import { RouteLocationNormalized, Router } from 'vue-router'

const createRequestProcessor = ({ configStore }: { configStore: ConfigStore }) => {
  let firstHitSent = false

  return (request: string): string => {
    try {
      const params = new URLSearchParams(request)
      if (params.get('url')) {
        params.set('url', new URL(params.get('url')).origin + '/')
      }

      // the referrer only tells whether the visit started in embed mode, never where it came from
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

const trackAppUsage = ({
  tracker,
  appsStore,
  to,
  from
}: {
  tracker: MatomoTracker
  appsStore: AppsStore
  to: RouteLocationNormalized
  from: RouteLocationNormalized
}): void => {
  if (to.name === from.name) {
    return
  }

  const entry = appsStore.fileExtensions.find((e) => (e.routeName || e.app) === to.name)
  if (!entry) {
    return
  }

  const file = String(to.params.driveAliasAndItem || '')
  tracker.trackEvent('App', entry.app, getExtension(file))
}

const trackUploads = ({ tracker }: { tracker: MatomoTracker }): void => {
  eventBus.subscribe('uploadSuccess', (file: UppyResource) => {
    tracker.trackEvent('Upload', 'File', getExtension(file.name))
  })
}

const trackDownloads = ({ tracker }: { tracker: MatomoTracker }): void => {
  // every download ends in triggerDownloadWithFilename, which clicks a temporary <a download>
  document.addEventListener('click', (event) => {
    const link = event.target
    if (!(link instanceof HTMLAnchorElement) || !link.hasAttribute('download')) {
      return
    }

    const isArchive = link.href.includes('/archiver')
    // file versions are served from <dav>/meta/<fileId>/v/<version>
    const isVersion = link.href.includes('/meta/') && link.href.includes('/v/')
    const type = isArchive ? 'Folder/Archive' : isVersion ? 'File Version' : 'File'
    tracker.trackEvent('Download', type, getExtension(link.download))
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

const sharePages: Record<string, string> = {
  [locationSharesWithMe.name]: 'Page: Shared with me',
  [locationSharesWithOthers.name]: 'Page: Shared with others',
  [locationSharesViaLink.name]: 'Page: Shared publicly'
}

const trackSharesAccess = ({
  tracker,
  to,
  from
}: {
  tracker: MatomoTracker
  to: RouteLocationNormalized
  from: RouteLocationNormalized
}): void => {
  const page = sharePages[String(to.name)]
  if (!page || to.name === from.name) {
    return
  }

  tracker.trackEvent('Shares', page)
}

const trashOverviewRouteName = createLocationTrash('files-trash-overview').name
const trashSpaceRouteName = createLocationTrash('files-trash-generic').name

const trackTrashBinOverview = ({
  tracker,
  to,
  from
}: {
  tracker: MatomoTracker
  to: RouteLocationNormalized
  from: RouteLocationNormalized
}): void => {
  if (to.name !== trashOverviewRouteName || to.name === from.name) {
    return
  }

  tracker.trackEvent('Trash Bin', 'Opened Overview')
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
  const { host, siteId, domains = [] } = configStore.matomo || {}
  if (!host || !siteId) {
    return
  }

  const tracker = initMatomo({
    host,
    siteId,
    domains,
    trackRouter: true,
    enableLinkTracking: false,
    preInitActions: [['setCustomRequestProcessing', createRequestProcessor({ configStore })]]
  })

  // metrics that rely only on the route
  watch(router.currentRoute, (to, from) => {
    trackAppUsage({ tracker, appsStore, to, from })
    trackSharesAccess({ tracker, to, from })
    trackTrashBinOverview({ tracker, to, from })
  })

  // the trash bin of a space is resolved like a folder of that space, so it is kept apart:
  // opening a project's trash bin must not count as accessing the project
  let previousSpace: SpaceResource
  let previousTrashSpace: SpaceResource
  // metrics that rely on the space
  watch(
    () => spacesStore.currentSpace,
    (currentSpace) => {
      if (router.currentRoute.value.name === trashSpaceRouteName) {
        trackTrashBinAccess({ tracker, currentSpace, previousSpace: previousTrashSpace })
        previousTrashSpace = currentSpace
        return
      }

      trackProjectAccess({ tracker, currentSpace, previousSpace })
      trackSharedContentAccess({ tracker, currentSpace, previousSpace })
      previousSpace = currentSpace
      previousTrashSpace = undefined
    }
  )

  // metrics that do not rely on a state change
  trackUser({ tracker, authStore, userStore })
  trackUploads({ tracker })
  trackDownloads({ tracker })
  trackVersionsPanel({ tracker })
  trackVersionRestores({ tracker })
  trackTrashBinRestores({ tracker, spacesStore })
  trackSearches({ tracker })
  trackErrors({ tracker, messagesStore, router })
}
