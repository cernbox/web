import { isProjectsRoute } from '../../helpers/route'

export default {
  computed: {
    $_open_trashbin() {
      return [
        {
          icon: 'delete',
          handler: (resource) => this.$_navigate_to_trashbin(resource),
          label: () =>
            this.$pgettext(
              'Action in the files list row to go to trashbin of selected project',
              'Open trashbin'
            ),
          isEnabled: ({ resource }) => {
            console.log('wihich route', isProjectsRoute)
            if (!isProjectsRoute(this.$route)) {
              return false
            }

            return true
          },
          componentType: 'oc-button',
          class: 'oc-files-actions-accept-share-trigger'
        }
      ]
    }
  },
  methods: {
    $_navigate_to_trashbin(resource) {
      this.$router.push({
        path: '/files/list/trash-bin-project',
        query: { project: resource.path, name: resource.name }
      })
    }
  }
}
