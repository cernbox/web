import { Store } from 'vuex'
import {
  isLocationTrashActive,
  isLocationPublicActive,
  isLocationSharesActive
} from '../../../router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useRouter, useStore } from 'web-pkg/src/composables'
import { FileAction } from 'web-pkg/src/composables/actions/types'
import { join } from 'path'
import { useClipboard } from '@vueuse/core'

export const useFileActionsCopyUrl = ({ store }: { store?: Store<any> } = {}) => {
  store = store || useStore()
  const router = useRouter()

  const { copy } = useClipboard({ legacy: true, copiedDuring: 550 })

  const { $gettext } = useGettext()

  const actions = computed((): FileAction[] => [
    {
      name: 'copy-url',
      icon: 'link',
      componentType: 'button',
      class: 'oc-files-actions-copy-url-trigger',
      label: () => $gettext('Copy URL'),

      isEnabled: ({ resources }) => {
        if (resources.length > 1) {
          return false
        }

        if (isLocationTrashActive(router, 'files-trash-generic')) {
          return false
        }

        if (isLocationPublicActive(router, 'files-public-link')) {
          return false
        }

        if (isLocationSharesActive(router, 'files-shares-with-me')) {
          return false
        }

        return resources.length > 0
      },
      handler({ resources }) {
        copy(
          encodeURI(
            join(window.location.hostname, router.currentRoute.value.path, resources[0].name)
          )
        )

        store.dispatch(
          'showMessage',
          {
            title: $gettext('Copied file url to clipboard!'),
            status: 'success'
          },
          { root: true }
        )
      }
    }
  ])

  return {
    actions
  }
}
