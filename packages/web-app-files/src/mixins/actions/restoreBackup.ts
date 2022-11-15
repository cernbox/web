import { mapActions, mapGetters, mapState } from 'vuex'
import { isLocationCommonActive } from '../../router'

export default {
  computed: {
    ...mapState(['user']),
    ...mapState('runtime/spaces', ['spaces']),
    ...mapGetters(['configuration', 'capabilities']),

    $_restore_items() {
      return [
        {
          name: 'restore',
          icon: 'arrow-go-back',
          label: () => this.$gettext('Restore'),
          handler: this.$_restore_trigger,
          isEnabled: ({ resources }) => {
            return (
              (resources.length === 1 &&
                (resources[0].path.startsWith(
                  `/cback/eos/home-${this.user.id.charAt(0)}/${this.user.id}`
                ) ||
                  resources[0].path.startsWith(`/cback/eos/project-`))) ||
              isLocationCommonActive(this.$router, 'files-common-backups-me') ||
              isLocationCommonActive(this.$router, 'files-common-backups-projects')
            )
          },
          componentType: 'oc-button',
          class: 'oc-files-actions-restore-trigger'
        }
      ]
    }
  },
  methods: {
    ...mapActions(['showMessage']),

    async $_restore_trigger({ resources }) {
      const url = `/cback/restores?path=${resources[0].path}`
      const accessToken = this.$store.getters['runtime/auth/accessToken']

      const headers = new Headers()
      headers.append('Authorization', 'Bearer ' + accessToken)
      headers.append('X-Requested-With', 'XMLHttpRequest')
      const response = await fetch(url, {
        method: 'POST',
        headers
      })

      if (response.status !== 200) {
        this.showMessage({
          title: this.$gettext('An error occurred'),
          desc: this.$gettext('Backup restore could not be initiated'),
          status: 'danger'
        })
      } else {
        this.showMessage({
          title: this.$gettext('Success'),
          desc: this.$gettext('Backup restore was initiated'),
          status: 'success'
        })
      }
    }
  }
}
