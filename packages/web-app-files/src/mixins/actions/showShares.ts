import quickActions, { canShare } from '../../quickActions'
import { isLocationSharesActive, isLocationTrashActive } from '../../router'
import { ShareStatus } from 'web-client/src/helpers/share'
import isFilesAppActive from './helpers/isFilesAppActive'
import { isLocationCommonActive } from '../../router'

export default {
  mixins: [isFilesAppActive],
  computed: {
    $_showShares_items() {
      return [
        {
          name: 'show-shares',
          icon: quickActions.collaborators.icon,
          iconFillType: quickActions.collaborators.iconFillType,
          label: () => this.$gettext('Share'),
          handler: this.$_showShares_trigger,
          isEnabled: ({ resources }) => {
            // sidebar is currently only available inside files app
            if (!this.$_isFilesAppActive) {
              return false
            }

            if (
              isLocationTrashActive(this.$router, 'files-trash-personal') ||
              isLocationTrashActive(this.$router, 'files-trash-spaces-project')
            ) {
              return false
            }
            if (
              isLocationCommonActive(this.$router, 'files-common-projects-trash') ||
              isLocationCommonActive(this.$router, 'files-common-projects')
            ) {
              return false
            }
            if (resources.length !== 1) {
              return false
            }
            if (isLocationSharesActive(this.$router, 'files-shares-with-me')) {
              if (resources[0].status !== ShareStatus.accepted) {
                return false
              }
            }
            return canShare(resources[0], this.$store)
          },
          componentType: 'button',
          class: 'oc-files-actions-show-shares-trigger'
        }
      ]
    }
  },
  methods: {
    async $_showShares_trigger({ resources }) {
      await this.$store.dispatch('Files/sidebar/openWithPanel', 'sharing-item#peopleShares')
    }
  }
}
