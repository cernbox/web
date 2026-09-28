import { computed, unref } from 'vue'
import {
  isLocationCommonActive,
  isLocationSharesActive,
  isLocationSpacesActive
} from '../../../router'
import { useGettext } from 'vue3-gettext'
import { FileAction, FileActionOptions, useIsFilesAppActive } from '../../actions'
import { useRouter } from '../../router'
import { useClientService } from '../../clientService'
import { useAbility } from '../../ability'
import {
  useMessages,
  useCapabilityStore,
  useResourcesStore,
  useSpacesStore
} from '../../piniaStores'
import { useEventBus } from '../../eventBus'
import { isSpaceResource, EOS_EXPLORER_SPACE_ID } from '@ownclouders/web-client'

export const useFileActionsFavorite = () => {
  const { showErrorMessage } = useMessages()
  const capabilityStore = useCapabilityStore()
  const router = useRouter()
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const isFilesAppActive = useIsFilesAppActive()
  const ability = useAbility()
  const resourcesStore = useResourcesStore()
  const spacesStore = useSpacesStore()
  const eventBus = useEventBus()

  const handler = async ({ space, resources }: FileActionOptions) => {
    try {
      const newValue = !resources[0].starred
      const targetSpace = isSpaceResource(resources[0]) ? resources[0] : space
      await clientService.webdav.setFavorite(targetSpace, resources[0], newValue)

      resourcesStore.updateResourceField({ id: resources[0].id, field: 'starred', value: newValue })

      if (resourcesStore.currentFolder?.id === resources[0].id) {
        resourcesStore.currentFolder.starred = newValue
      }

      if (isSpaceResource(resources[0])) {
        spacesStore.updateSpaceField({ id: resources[0].id, field: 'starred', value: newValue })
      }

      if (!newValue) {
        eventBus.publish('app.files.list.removeFromFavorites', resources[0].id)
      }
    } catch (error) {
      const title = $gettext(
        'Failed to change favorite state of "%{file}"',
        { file: resources[0].name },
        true
      )
      showErrorMessage({ title, errors: [error] })
    }
  }

  const actions = computed((): FileAction[] => [
    {
      name: 'favorite',
      icon: 'star',
      handler,
      label: ({ resources }) => {
        if (resources[0].starred) {
          return $gettext('Remove from favorites')
        }
        return $gettext('Add to favorites')
      },
      isVisible: ({ resources }) => {
        if (
          unref(isFilesAppActive) &&
          !isLocationSpacesActive(router, 'files-spaces-generic') &&
          !isLocationCommonActive(router, 'files-common-office') &&
          !isLocationCommonActive(router, 'files-common-favorites') &&
          !isLocationSharesActive(router, 'files-shares-with-me') &&
          !isLocationSharesActive(router, 'files-shares-with-others') &&
          !isLocationSharesActive(router, 'files-shares-via-link')
        ) {
          return false
        }

        if (resources.length !== 1) {
          return false
        }

        if (resources[0].id === EOS_EXPLORER_SPACE_ID) {
          return false
        }

        return capabilityStore.filesFavorites && ability.can('create', 'Favorite')
      },
      class: 'oc-files-actions-favorite-trigger'
    }
  ])

  return {
    actions
  }
}
