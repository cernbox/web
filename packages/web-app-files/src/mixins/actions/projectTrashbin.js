import { isProjectsRoute } from '../../helpers/route'

export default {
  computed: {
    $_project_trashbin() {
      return [
        {
          icon: 'delete',
          handler: this.$_navigate_to_trashbin,
          label: () =>
            this.$pgettext(
              'Action in the files list row to go to trashbin of selected project',
              'Open trashbin'
            ),
          isEnabled: ({ resources }) => {
            if (resources.length !== 1) {
              return false
            }
            // TODO
            // if resources[0].path === /eos/project/x/xxxx || isProjectsRoute(this.$route) -> return true
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
    $_navigate_to_trashbin({ resources }) {
      this.$router.push({
        path: '/files/list/trash-bin-project',
        query: { project: resources[0].path, name: resources[0].name }
      })
    }
  }
}
