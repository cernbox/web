<template>
  <div class="uk-flex uk-flex-middle">
    <template v-if="isTrashbinRoute">
      <oc-button
        v-if="selectedFiles.length > 0"
        id="restore-selected-btn"
        key="restore-btn"
        class="oc-mr-s"
        @click="restoreFiles()"
      >
        <oc-icon name="restore" />
        <translate>Restore</translate>
      </oc-button>
      <oc-button
        id="delete-selected-btn"
        key="delete-btn"
        @click="selectedFiles.length < 1 ? emptyTrashbin() : $_deleteResources_displayDialog()"
      >
        <oc-icon name="delete" />
        {{ clearTrashbinButtonText }}
      </oc-button>
    </template>
    <oc-grid v-if="displayBulkActions" gutter="small">
      <div v-if="canCopy">
        <oc-button
          id="copy-selected-btn"
          key="copy-selected-btn"
          @click="triggerLocationPicker('copy')"
        >
          <oc-icon name="file_copy" />
          <translate>Copy</translate>
        </oc-button>
      </div>
      <div v-if="canMove">
        <oc-button
          id="move-selected-btn"
          key="move-selected-btn"
          @click="triggerLocationPicker('move')"
        >
          <oc-icon name="folder-move" />
          <translate>Move</translate>
        </oc-button>
      </div>
      <div v-if="canDelete">
        <oc-button
          id="delete-selected-btn"
          key="delete-selected-btn"
          @click="$_deleteResources_displayDialog"
        >
          <oc-icon name="delete" />
          <translate>Delete</translate>
        </oc-button>
      </div>
      <div v-if="canAccept">
        <oc-button
          id="accept-selected-shares-btn"
          key="accept-shares-btn"
          variation="primary"
          @click="acceptShares()"
        >
          <oc-icon name="check" />
          <translate>Accept</translate>
        </oc-button>
      </div>
      <div v-if="canDecline">
        <oc-button
          id="decline-selected-shares-btn"
          key="decline-shares-btn"
          variation="primary"
          @click="declineShares()"
        >
          <oc-icon name="not_interested" />
          <translate>Decline</translate>
        </oc-button>
      </div>
    </oc-grid>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapMutations } from 'vuex'

import MixinRoutes from '../../../mixins/routes'
import MixinDeleteResources from '../../../mixins/deleteResources'
import { cloneStateObject } from '../../../helpers/store'
import { canBeMoved } from '../../../helpers/permissions'
import { checkRoute } from '../../../helpers/route'
import { shareStatus } from '../../../helpers/shareStatus'
import { triggerShareAction } from '../../../helpers/share/triggerShareAction'
import PQueue from 'p-queue'

export default {
  mixins: [MixinRoutes, MixinDeleteResources],

  computed: {
    ...mapGetters('Files', ['selectedFiles', 'currentFolder', 'activeFiles']),

    clearTrashbinButtonText() {
      return this.selectedFiles.length < 1 ? this.$gettext('Empty') : this.$gettext('Delete')
    },

    canMove() {
      if (
        !checkRoute(['files-personal', 'files-public-list', 'files-favorites'], this.$route.name)
      ) {
        return false
      }

      const moveDisabled = this.selectedFiles.some(resource => {
        return canBeMoved(resource, this.currentFolder.path) === false
      })
      return !moveDisabled
    },

    canCopy() {
      if (
        !checkRoute(['files-personal', 'files-public-list', 'files-favorites'], this.$route.name)
      ) {
        return false
      }

      if (this.isPublicFilesRoute) {
        return this.currentFolder.canCreate()
      }

      return true
    },

    canDelete() {
      if (this.isSharedWithMeRoute) {
        return false
      }

      if (this.isPublicFilesRoute) {
        return this.currentFolder.canBeDeleted()
      }
      if (checkRoute(['files-shared-with-me'], this.$route.name)) {
        return false
      }

      const deleteDisabled = this.selectedFiles.some(resource => {
        return !resource.canBeDeleted()
      })
      return !deleteDisabled
    },

    canAccept() {
      if (!checkRoute(['files-shared-with-me'], this.$route.name)) {
        return false
      }
      let canAccept = true
      this.selectedFiles.forEach(file => {
        if (file.status === shareStatus.accepted) {
          canAccept = false
        }
      })

      return canAccept
    },

    canDecline() {
      if (!checkRoute(['files-shared-with-me'], this.$route.name)) {
        return false
      }
      let canDecline = true
      this.selectedFiles.forEach(file => {
        if (file.status === shareStatus.declined) canDecline = false
      })
      return canDecline
    },

    displayBulkActions() {
      return this.$route.meta.hasBulkActions && this.selectedFiles.length > 0
    }
  },

  methods: {
    ...mapActions('Files', ['removeFilesFromTrashbin', 'resetFileSelection', 'setHighlightedFile']),
    ...mapActions(['showMessage']),
    ...mapMutations('Files', [
      'LOAD_FILES',
      'SELECT_RESOURCES',
      'CLEAR_CURRENT_FILES_LIST',
      'UPDATE_RESOURCE'
    ]),

    restoreFiles(resources = this.selectedFiles) {
      for (const resource of resources) {
        this.$client.fileTrash
          .restore(resource.id, resource.path)
          .then(() => {
            const translated = this.$gettext('%{resource} was restored successfully')
            this.showMessage({
              title: this.$gettextInterpolate(translated, { resource: resource.name }, true),
              autoClose: {
                enabled: true
              }
            })
            this.removeFilesFromTrashbin([resource])
          })
          .catch(error => {
            const translated = this.$gettext('Restoration of %{resource} failed')
            this.showMessage({
              title: this.$gettextInterpolate(translated, { resource: resource.name }, true),
              desc: error.message,
              status: 'danger',
              autoClose: {
                enabled: true
              }
            })
          })
      }
      this.resetFileSelection()
      this.setHighlightedFile(null)
    },

    emptyTrashbin() {
      this.$client.fileTrash
        .clearTrashBin()
        .then(() => {
          this.showMessage({
            title: this.$gettext('All deleted files were removed'),
            autoClose: {
              enabled: true
            }
          })
          this.removeFilesFromTrashbin(this.activeFiles)
        })
        .catch(error => {
          this.showMessage({
            title: this.$gettext('Could not delete files'),
            desc: error.message,
            status: 'danger',
            autoClose: {
              enabled: true
            }
          })
        })
    },

    triggerLocationPicker(action) {
      const resources = cloneStateObject(this.selectedFiles)
      const context = this.isPublicPage ? 'public' : 'private'

      this.$router.push({
        name: 'files-location-picker',
        params: {
          context,
          item: this.currentFolder.path,
          action
        },
        query: {
          resource: resources.map(resource => {
            return resource.path
          })
        }
      })
    },

    // Lisas implementation
    acceptShares() {
      this.selectedFiles.forEach(resource => {
        this.triggerShareAction(resource, 'POST')
      })
    },

    acceptShares() {
      this.triggerShareActions(shareStatus.accepted)
    },

    declineShares() {
      this.triggerShareActions(shareStatus.declined)
    },

    async triggerShareActions(newShareStatus) {
      const errors = []
      const triggerPromises = []
      const triggerQueue = new PQueue({ concurrency: 4 })
      this.selectedFiles.forEach(resource => {
        triggerPromises.push(
          triggerQueue.add(async () => {
            try {
              const share = await triggerShareAction(
                resource,
                newShareStatus,
                !this.isOcis,
                this.$client
              )
              if (share) {
                this.UPDATE_RESOURCE(share)
              }
            } catch (error) {
              errors.push(error)
            }
          })
        )
      })
      await Promise.all(triggerPromises)

      if (errors.length === 0) {
        this.resetFileSelection()
        return
      }

      console.log(errors)
      if (newShareStatus === shareStatus.accepted) {
        this.showMessage({
          title: this.$ngettext(
            'Error while accepting the selected share.',
            'Error while accepting selected shares.',
            this.selectedFiles.length
          ),
          status: 'danger'
        })
        return
      }
      if (newShareStatus === shareStatus.declined) {
        this.showMessage({
          title: this.$ngettext(
            'Error while declining the selected share.',
            'Error while declining selected shares.',
            this.selectedFiles.length
          ),
          status: 'danger'
        })
      }
    }
  }
}
</script>
