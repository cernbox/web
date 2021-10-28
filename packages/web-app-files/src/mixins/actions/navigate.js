import { isTrashbinRoute, isSharedWithMeRoute } from '../../helpers/route'
import { mapState } from 'vuex'
import { isSameResource } from '../../helpers/resource'

export default {
  computed: {
    ...mapState('Files', ['currentFolder']),
    $_navigate_items() {
      return [
        {
          icon: 'folder-open',
          handler: (resource) => this.$_navigate_trigger(resource),
          label: () =>
            this.$pgettext('Action in the files list row to open a folder', 'Open folder'),
          isEnabled: ({ resource }) => {
            if (isTrashbinRoute(this.$route)) {
              return false
            }

            if (isSharedWithMeRoute(this.$route) && resource.status !== 0) {
              return false
            }

            if (isSameResource(resource, this.currentFolder)) {
              return false
            }

            return resource.type === 'folder'
          },
          canBeDefault: true,
          componentType: 'router-link',
          route: this.route,
          class: 'oc-files-actions-navigate-trigger'
        }
      ]
    },
    route() {
      let route = 'files-personal'
      if (this.publicPage()) {
        route = 'files-public-list'
      }

      return route
    }
  }
}
