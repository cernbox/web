import { createLocationTrash, isLocationSpacesActive } from '../../router'
import { createFileRouteOptions } from 'web-pkg/src/helpers/router'

export default {
  computed: {
    $_deletedFiles_items() {
      return [
        {
          name: 'deletedFiles',
          icon: 'delete-bin-5',
          label: () => {
            return this.$gettext('Deleted files')
          },
          handler: this.$_deletedFiles_trigger,
          isEnabled: ({ resources }) => {

            if (!isLocationSpacesActive(this.$router, 'files-spaces-generic')) {
              return false
            }

            if (resources.length !== 1) {
              return false
            }

            const elems = this.$router.currentRoute?.path?.split('/').filter(Boolean) || [] //"/files/spaces/eos/project/c/cernbox"
            if (elems.length !== 6 || elems[3] !== 'project') {
              return false
            }

            return true
          },
          componentType: 'button',
          class: 'oc-files-actions-delete-trigger'
        }
      ]
    }
  },
  methods: {
    $_deletedFiles_trigger() {
      return this.$router.push(
        createLocationTrash(
          'files-trash-generic',
          createFileRouteOptions(this.space, {
            path: this.$router.currentRoute?.path?.split('/').filter(Boolean).slice(2).join('/')
          })
        )
      )
    }
  }
}
