import { dirname } from 'path'
import merge from 'lodash-es/merge'
import {
  createLocationPublic,
  createLocationSpaces,
  isLocationCommonActive,
  isLocationPublicActive,
  isLocationSharesActive,
  isLocationSpacesActive
} from '../../../router'
import { useIsFilesAppActive } from '../helpers'
import { useRouter } from '../../router'
import { FileAction, FileActionOptions } from '../types'
import { useIsSearchActive } from '../helpers'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useClientService } from '../../clientService'
import DOMPurify from 'dompurify'
import { useConfigStore, useMessages, useSpacesStore } from '../../piniaStores'
import { createFileRouteOptions } from '../../../helpers/router'
import { buildWebDavSpacesPath, Resource, SpaceResource } from '@ownclouders/web-client'

export const useFileActionsOpenShortcut = () => {
  const { showErrorMessage } = useMessages()
  const router = useRouter()
  const { $gettext } = useGettext()
  const isFilesAppActive = useIsFilesAppActive()
  const isSearchActive = useIsSearchActive()
  const clientService = useClientService()
  const configStore = useConfigStore()
  const spacesStore = useSpacesStore()

  const extractUrl = (fileContents: string) => {
    const regex = /URL=(.+)/
    const match = fileContents.match(regex)

    if (match && match[1]) {
      return match[1]
    } else {
      throw new Error('unable to extract url')
    }
  }
  // Returns the space of the target of a link, if known to the user. Project
  // spaces are loaded lazily, hence they are loaded here if needed.
  const getLinkTargetSpace = async (link: Resource, space: SpaceResource) => {
    const spaceId = link.linkTargetSpaceId
    if (!spaceId || spaceId === space.id) {
      return space
    }
    let targetSpace = spacesStore.getSpace(spaceId)
    if (!targetSpace && !spacesStore.isTypeInitialized('project')) {
      try {
        await spacesStore.loadSpacesByType('project', {
          graphClient: clientService.graphAuthenticated
        })
      } catch (e) {
        console.error(e)
      }
      targetSpace = spacesStore.getSpace(spaceId)
    }
    return targetSpace
  }

  // Symbolic links and Windows shortcuts are resolved by the server, which only
  // exposes their target when it is accessible: navigate there, so that the
  // target and not the link shows up in the URL.
  const openLinkTarget = async ({ resources, space }: FileActionOptions) => {
    const link = resources[0]
    const targetSpace = await getLinkTargetSpace(link, space)
    let target: Resource
    try {
      // a target space not in the list of spaces of the user (e.g. reachable
      // through a share only) is accessed by its webdav path
      target = await clientService.webdav.getFileInfo(
        targetSpace ||
          ({
            id: link.linkTargetSpaceId,
            webDavPath: buildWebDavSpacesPath(link.linkTargetSpaceId)
          } as SpaceResource),
        { path: link.linkTarget }
      )
    } catch (e) {
      console.error(e)
      showErrorMessage({
        title: $gettext('The target of "%{name}" is not available', { name: link.name }),
        errors: [e]
      })
      return
    }

    if (!targetSpace) {
      // let the private link resolution find the way to the target
      await router.push({ name: 'resolvePrivateLink', params: { fileId: target.fileId } })
      return
    }

    const location = isLocationPublicActive(router, 'files-public-link')
      ? createLocationPublic('files-public-link')
      : createLocationSpaces('files-spaces-generic')

    // on EOS a file path is displayed on its own and opened with its default app
    if (target.isFolder || configStore.options.runningOnEos) {
      await router.push(
        merge(
          {},
          location,
          createFileRouteOptions(targetSpace, { path: target.path, fileId: target.fileId })
        )
      )
      return
    }

    const { params, query } = createFileRouteOptions(targetSpace, {
      path: dirname(target.path),
      fileId: target.parentFolderId
    })
    await router.push(
      merge({}, location, {
        params,
        query: { ...query, scrollTo: target.fileId, openWithDefaultApp: 'true' }
      })
    )
  }

  const handler = async ({ resources, space }: FileActionOptions) => {
    if (resources[0].linkTarget) {
      await openLinkTarget({ resources, space })
      return
    }
    try {
      const webURL = new URL(window.location.href)
      const fileContents = (await clientService.webdav.getFileContents(space, resources[0])).body
      let url = extractUrl(fileContents)

      // Add protocol if missing
      url = url.match(/^http[s]?:\/\//) ? url : `https://${url}`

      // Omit possible xss code
      url = DOMPurify.sanitize(url, { USE_PROFILES: { html: true } })

      if (url.startsWith(webURL.origin)) {
        window.location.href = url
        return
      }

      window.open(url)
    } catch (e) {
      console.error(e)
      showErrorMessage({
        title: $gettext('Failed to open shortcut'),
        errors: [e]
      })
    }
  }

  const actions = computed((): FileAction[] => [
    {
      name: 'open-shortcut',
      icon: 'external-link',
      category: 'context',
      // a link must open its target, even when its name matches an editor
      hasPriority: true,
      handler,
      label: () => {
        return $gettext('Open shortcut')
      },
      isVisible: ({ resources }) => {
        if (
          unref(isFilesAppActive) &&
          !unref(isSearchActive) &&
          !isLocationSpacesActive(router, 'files-spaces-generic') &&
          !isLocationPublicActive(router, 'files-public-link') &&
          !isLocationCommonActive(router, 'files-common-favorites') &&
          !isLocationCommonActive(router, 'files-common-search') &&
          !isLocationSharesActive(router, 'files-shares-with-me') &&
          !isLocationSharesActive(router, 'files-shares-with-others') &&
          !isLocationSharesActive(router, 'files-shares-via-link')
        ) {
          return false
        }
        if (resources.length !== 1) {
          return false
        }
        if (resources[0].linkTarget) {
          return true
        }
        if (resources[0].extension !== 'url') {
          return false
        }
        return resources[0].canDownload()
      },
      class: 'oc-files-actions-open-short-cut-trigger'
    }
  ])

  return {
    actions,

    // Hack for unit tests
    extractUrl
  }
}
