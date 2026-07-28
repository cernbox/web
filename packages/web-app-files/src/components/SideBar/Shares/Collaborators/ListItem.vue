<template>
  <div
    :data-testid="`collaborator-${isAnyUserShareType ? 'user' : 'group'}-item-${
      share.sharedWith.displayName
    }`"
    class="files-collaborators-collaborator oc-py-xs"
  >
    <div class="oc-width-1-1 oc-flex oc-flex-middle files-collaborators-collaborator-details">
      <div class="oc-width-2-3 oc-flex oc-flex-middle">
        <div>
          <template v-if="isShareDenied">
            <oc-avatar-item
              :width="36"
              icon-size="medium"
              icon="stop"
              :name="$gettext('Access denied')"
              class="files-collaborators-collaborator-indicator"
            />
          </template>
          <template v-else>
            <avatar-image
              v-if="isAnyUserShareType"
              :userid="share.sharedWith.id"
              :user-name="share.sharedWith.displayName"
              :width="36"
              class="files-collaborators-collaborator-indicator"
            />
            <oc-avatar-item
              v-else
              :width="36"
              icon-size="medium"
              :icon="shareTypeIcon"
              :name="shareTypeKey"
              class="files-collaborators-collaborator-indicator"
            />
          </template>
        </div>
        <div class="files-collaborators-collaborator-name-wrapper oc-pl-s">
          <div class="oc-text-truncate">
            <span
              v-oc-tooltip="
                shareDisplayName + (share.sharedWith.id ? ` (${share.sharedWith.id})` : '')
              "
              aria-hidden="true"
              class="files-collaborators-collaborator-name"
              v-text="shareDisplayName"
            />
            <span class="oc-invisible-sr" v-text="screenreaderShareDisplayName" />
            <oc-contextual-helper
              v-if="isExternalShare"
              :text="
                $gettext(
                  'External user, registered with another organization’s account but granted access to your resources. External users can only have “view” or “edit” permission.'
                )
              "
              :title="$gettext('External user')"
            />
          </div>
          <div>
            <div
              v-if="isShareDenied"
              v-oc-tooltip="shareDeniedTooltip"
              class="oc-flex oc-flex-nowrap oc-flex-middle"
              v-text="$gettext('Access denied')"
            />
            <template v-else>
              <div v-if="modifiable" class="oc-flex oc-flex-nowrap oc-flex-middle">
                <role-dropdown
                  ref="roleDropdownRef"
                  :dom-selector="shareDomSelector"
                  :existing-share-role="share.role"
                  :existing-share-permissions="share.permissions"
                  :is-locked="isLocked"
                  :is-external="isExternalShare"
                  class="files-collaborators-collaborator-role"
                  mode="edit"
                  @option-change="shareRoleChanged"
                />
              </div>
              <div v-else-if="share.role">
                <span
                  v-oc-tooltip="$gettext(share.role.description)"
                  class="oc-mr-xs"
                  v-text="$gettext(share.role.displayName)"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="oc-flex oc-flex-middle oc-width-1-3 files-collaborators-collaborator-navigation">
        <expiration-date-indicator
          v-if="hasExpirationDate"
          class="files-collaborators-collaborator-expiration oc-mr-xs"
          data-testid="recipient-info-expiration-date"
          :expiration-date="DateTime.fromISO(share.expirationDateTime)"
        />
        <oc-icon
          v-if="!isShareDenied && sharedParentRoute"
          v-oc-tooltip="sharedViaTooltip"
          name="folder-shared"
          fill-type="line"
          class="files-collaborators-collaborator-shared-via oc-mx-xs"
        />
        <edit-dropdown
          class="files-collaborators-collaborator-edit oc-ml-xs"
          data-testid="collaborator-edit"
          :expiration-date="share.expirationDateTime ? share.expirationDateTime : null"
          :share-category="shareCategory"
          :can-edit="modifiable"
          :is-share-denied="isShareDenied"
          :is-locked="isLocked"
          :deniable="deniable"
          :shared-parent-route="!isShareDenied ? sharedParentRoute : undefined"
          :access-details="accessDetails"
          @expiration-date-changed="shareExpirationChanged"
          @remove-share="removeShare"
          @set-deny-share="setDenyShare"
          @notify-share="showNotifyShareModal"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { storeToRefs } from 'pinia'
import { DateTime } from 'luxon'

import EditDropdown from './EditDropdown.vue'
import RoleDropdown from './RoleDropdown.vue'
import {
  CollaboratorShare,
  ShareRole,
  ShareTypes,
  isSharingHierarchyConflictRemoveShareError,
  isSharingHierarchyConflictUserAbortError
} from '@ownclouders/web-client'
import {
  queryItemAsString,
  useMessages,
  useModals,
  useSpacesStore,
  useUserStore,
  useSharesStore,
  useConfigStore,
  useSharingHierarchyConflictConfirm,
  useSharingHierarchyConflictInform
} from '@ownclouders/web-pkg'
import { Resource, extractDomSelector } from '@ownclouders/web-client'
import { computed, defineComponent, inject, PropType, Ref, ref, unref } from 'vue'
import { formatDateFromDateTime } from '@ownclouders/web-pkg'
import { useClientService } from '@ownclouders/web-pkg'
import { RouteLocationNamedRaw } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import { SpaceResource } from '@ownclouders/web-client'
import { isProjectSpaceResource } from '@ownclouders/web-client'
import { ContextualHelperDataListItem } from '@ownclouders/design-system/helpers'
import ExpirationDateIndicator from '../ExpirationDateIndicator.vue'

export default defineComponent({
  name: 'ListItem',
  components: {
    ExpirationDateIndicator,
    EditDropdown,
    RoleDropdown
  },
  props: {
    share: {
      type: Object as PropType<CollaboratorShare>,
      required: true
    },
    isShareDenied: {
      type: Boolean,
      default: false
    },
    modifiable: {
      type: Boolean,
      default: false
    },
    sharedParentRoute: {
      type: Object as PropType<RouteLocationNamedRaw>,
      default: null
    },
    resourceName: {
      type: String,
      default: ''
    },
    deniable: {
      type: Boolean,
      default: false
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    isSpaceShare: {
      type: Boolean,
      default: false
    }
  },
  emits: ['onDelete', 'onSetDeny'],
  setup(props, { emit }) {
    const { showMessage, showErrorMessage } = useMessages()
    const userStore = useUserStore()
    const clientService = useClientService()
    const language = useGettext()
    const { $gettext } = language
    const { dispatchModal } = useModals()

    const configStore = useConfigStore()
    const cernFeatures = unref(configStore).options.cernFeatures

    const sharesStore = useSharesStore()
    const { graphRoles } = storeToRefs(sharesStore)
    const { updateShare, deleteShare } = sharesStore
    const confirmSharingHierarchyConflict = useSharingHierarchyConflictConfirm({
      introVariant: 'update-share'
    })
    const informSharingHierarchyConflict = useSharingHierarchyConflictInform()
    const informRoleUpdateHierarchyConflict = useSharingHierarchyConflictInform({
      offerRemoveShare: true
    })
    const roleDropdownRef = ref<InstanceType<typeof RoleDropdown> | null>(null)
    const { upsertSpace } = useSpacesStore()

    const { user } = storeToRefs(userStore)

    const sharedParentDir = computed(() => {
      return queryItemAsString(props.sharedParentRoute?.params?.driveAliasAndItem).split('/').pop()
    })

    const shareDate = computed(() => {
      return formatDateFromDateTime(DateTime.fromISO(props.share.createdDateTime), language.current)
    })

    const isExternalShare = computed(() => props.share.shareType === ShareTypes.remote.value)

    const setDenyShare = (value: boolean) => {
      emit('onSetDeny', { share: props.share, value })
    }

    const showNotifyShareModal = () => {
      dispatchModal({
        variation: 'warning',
        icon: 'mail-send',
        title: $gettext('Send a reminder'),
        confirmText: $gettext('Send'),
        message: $gettext('Are you sure you want to send a reminder about this share?'),
        onConfirm: notifyShare
      })
    }
    const notifyShare = async () => {
      try {
        const resp = (await clientService.httpAuthenticated.post(
          `/ocs/v1.php/apps/files_sharing/api/v1/shares/${props.share.id}/notify`
        )) as any
        showMessage({
          title: $gettext(`Reminder sent to ${resp.data.recipients[0]}`)
        })
      } catch (error) {
        console.error(error)
        showErrorMessage({
          title: $gettext('Failed to send email reminder'),
          errors: [error]
        })
      }
    }

    const revertRoleDropdown = () => {
      roleDropdownRef.value?.revertToExistingRole?.()
    }

    const sharedViaTooltip = computed(() =>
      $gettext('Shared via the parent folder "%{sharedParentDir}"', {
        sharedParentDir: unref(sharedParentDir)
      })
    )
    return {
      resource: inject<Ref<Resource>>('resource'),
      space: inject<Ref<SpaceResource>>('space'),
      updateShare,
      deleteShare,
      confirmSharingHierarchyConflict,
      informSharingHierarchyConflict,
      informRoleUpdateHierarchyConflict,
      roleDropdownRef,
      revertRoleDropdown,
      user,
      clientService,
      cernFeatures,
      sharedParentDir,
      shareDate,
      graphRoles,
      setDenyShare,
      showNotifyShareModal,
      showMessage,
      showErrorMessage,
      upsertSpace,
      isExternalShare,
      sharedViaTooltip,
      DateTime
    }
  },
  computed: {
    shareType() {
      return ShareTypes.getByValue(this.share.shareType)
    },

    shareTypeIcon() {
      return this.shareType.icon
    },

    shareTypeKey() {
      return this.shareType.key
    },

    shareDomSelector() {
      if (!this.share.id) {
        return undefined
      }
      return extractDomSelector(this.share.id)
    },

    isAnyUserShareType() {
      return ShareTypes.user === this.shareType
    },

    shareTypeText() {
      return this.$gettext(this.shareType.label)
    },

    shareCategory() {
      return ShareTypes.isIndividual(this.shareType) ? 'user' : 'group'
    },

    shareDeniedTooltip() {
      return this.$gettext('%{shareType} cannot access %{resourceName}', {
        shareType: this.shareTypeText,
        resourceName: this.resourceName
      })
    },

    shareDisplayName() {
      if (this.user.id === this.share.sharedWith.id) {
        return this.$gettext('%{collaboratorName} (me)', {
          collaboratorName: this.share.sharedWith.displayName
        })
      }
      return this.share.sharedWith.displayName
    },

    screenreaderShareDisplayName() {
      const context = {
        displayName: this.share.sharedWith.displayName
      }

      return this.$gettext('Share receiver name: %{ displayName }', context)
    },

    hasExpirationDate() {
      return !!this.share.expirationDateTime
    },

    expirationDate() {
      return formatDateFromDateTime(
        DateTime.fromISO(this.share.expirationDateTime).endOf('day'),
        this.$language.current
      )
    },
    shareOwnerDisplayName() {
      return this.share.sharedBy.displayName
    },
    accessDetails() {
      const list: ContextualHelperDataListItem[] = []

      list.push({ text: this.$gettext('Name'), headline: true }, { text: this.shareDisplayName })

      if (this.share.sharedWith.id && this.cernFeatures) {
        list.push(
          { text: this.$gettext('Username'), headline: true },
          { text: `${this.share.sharedWith.id}` }
        )
      }

      list.push({ text: this.$gettext('Type'), headline: true }, { text: this.shareTypeText })
      list.push(
        { text: this.$gettext('Access expires'), headline: true },
        { text: this.hasExpirationDate ? this.expirationDate : this.$gettext('no') }
      )
      list.push({ text: this.$gettext('Shared on'), headline: true }, { text: this.shareDate })

      if (!this.isSpaceShare) {
        list.push(
          { text: this.$gettext('Invited by'), headline: true },
          { text: this.shareOwnerDisplayName }
        )
      }

      return list
    }
  },
  methods: {
    removeShare() {
      this.$emit('onDelete', this.share)
    },

    async shareRoleChanged(role: ShareRole) {
      const expirationDateTime = this.share.expirationDateTime
      await this.saveShareChanges({
        role,
        expirationDateTime,
        offerRemoveShareOnConflict: !this.share.indirect
      })
    },

    async shareExpirationChanged({ expirationDateTime }: { expirationDateTime: string }) {
      const role = this.share.role
      await this.saveShareChanges({ role, expirationDateTime })
    },

    handleShareConflictError(error: Error, title: string) {
      if (isSharingHierarchyConflictUserAbortError(error)) {
        this.revertRoleDropdown()
        return
      }
      console.error(error)
      this.revertRoleDropdown()
      this.showErrorMessage({ title, errors: [error] })
    },

    async saveShareChanges({
      role,
      expirationDateTime,
      offerRemoveShareOnConflict = false
    }: {
      role: ShareRole
      expirationDateTime?: string
      offerRemoveShareOnConflict?: boolean
    }) {
      const informSharingHierarchyConflict = offerRemoveShareOnConflict
        ? this.informRoleUpdateHierarchyConflict
        : this.informSharingHierarchyConflict

      try {
        await this.updateShare({
          clientService: this.$clientService,
          space: this.space,
          resource: this.resource,
          collaboratorShare: this.share,
          options: { roles: [role.id], expirationDateTime },
          confirmSharingHierarchyConflict: this.confirmSharingHierarchyConflict,
          informSharingHierarchyConflict
        })

        if (isProjectSpaceResource(this.resource)) {
          const client = this.clientService.graphAuthenticated
          const space = await client.drives.getDrive(this.resource.id, this.graphRoles)

          this.upsertSpace(space)
        }

        this.showMessage({ title: this.$gettext('Share successfully changed') })
      } catch (e) {
        if (isSharingHierarchyConflictRemoveShareError(e)) {
          try {
            await this.deleteShare({
              clientService: this.clientService,
              space: this.space,
              resource: this.resource,
              collaboratorShare: this.share,
              loadIndicators: true,
              confirmSharingHierarchyConflict: this.confirmSharingHierarchyConflict,
              informSharingHierarchyConflict: this.informSharingHierarchyConflict
            })
            this.showMessage({ title: this.$gettext('Share successfully removed') })
          } catch (deleteError) {
            this.handleShareConflictError(
              deleteError,
              this.$gettext('Error while removing the share.')
            )
          }
          return
        }

        this.handleShareConflictError(e, this.$gettext('Error while editing the share.'))
      }
    }
  }
})
</script>

<style lang="scss" scoped>
.sharee-avatar {
  min-width: 36px;
}

.files-collaborators-collaborator-navigation {
  align-items: center;
  justify-content: end;
}

.files-collaborators-collaborator-role {
  max-width: 100%;
}

.files-collaborators-collaborator-name-wrapper {
  max-width: 100%;
}
</style>
