import MixinDeleteResources from '../../mixins/deleteResources'
import { checkRoute } from '../../helpers/route'
import { mapState } from 'vuex'
import { isSameResource } from '../../helpers/resource'

export default {
  mixins: [MixinDeleteResources],
  computed: {
    ...mapState('Files', ['currentFolder']),
    $_delete_items() {
      return [
        {
          icon: 'delete',
          label: () => this.$gettext('Delete'),
          handler: this.$_delete_trigger,
          isEnabled: ({ resource }) => {
            if (
              checkRoute(
                [
                  'files-shared-with-me',
                  'files-trashbin',
                  'files-shared-with-others',
                  'files-shared-via-link'
                ],
                this.$route.name
              )
            ) {
              return false
            }

            if (isSameResource(resource, this.currentFolder)) {
              return false
            }

            return resource.canBeDeleted()
          },
          componentType: 'oc-button',
          class: 'oc-files-actions-delete-trigger'
        },
        {
          // this menu item is ONLY for the trashbin (permanently delete a file/folder)
          icon: 'delete',
          label: () => this.$gettext('Delete'),
          handler: this.$_delete_trigger,
          isEnabled: () => checkRoute(['files-trashbin'], this.$route.name),
          componentType: 'oc-button',
          class: 'oc-files-actions-delete-trigger'
        }
      ]
    }
  },
  methods: {
    $_delete_trigger(resource) {
      this.$_deleteResources_displayDialog(resource, true)
    }
  }
}
