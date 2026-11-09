<template>
  <div
    ref="dialog"
    class="share-modal"
    data-testid="share-modal"
    @keydown.esc="onEscape"
    @focusout="keepFocusInModal"
  >
    <oc-loader v-if="loading" :aria-label="$gettext('Loading list of shares')" />
    <template v-else>
      <space-members v-if="isSpace" />
      <template v-else>
        <invite-collaborator-form
          v-if="canShare({ resource, space })"
          key="new-collaborator"
          options-after-pick
        />
        <p
          v-else
          class="oc-mt-rm"
          data-testid="share-modal-no-share-permissions-message"
          v-text="noSharePermsMessage"
        />

        <h3
          class="oc-text-bold oc-text-medium oc-mt-m oc-mb-s"
          v-text="$gettext('People with access')"
        />
        <oc-text-input
          v-if="collaborators.length > peopleFilterMin || peopleFilter"
          v-model="peopleFilter"
          class="share-modal-people-filter oc-mb-s"
          :label="$gettext('Filter people')"
          :clear-button-enabled="true"
        />
        <ul
          class="oc-list oc-list-divider share-modal-people"
          :aria-label="$gettext('People with access')"
        >
          <li v-if="!peopleFilter" class="share-modal-owner oc-flex oc-flex-middle oc-py-xs">
            <avatar-image :userid="owner.id" :user-name="owner.displayName" :width="36" />
            <span class="oc-pl-s oc-text-truncate">
              {{ owner.displayName }}
              <span
                v-if="owner.id === user.id"
                class="oc-text-muted"
                v-text="`(${$gettext('you')})`"
              />
            </span>
            <span class="share-modal-owner-role oc-text-muted" v-text="$gettext('Owner')" />
          </li>
          <li v-for="collaborator in filteredCollaborators" :key="collaborator.id">
            <collaborator-list-item
              :share="collaborator"
              :resource-name="resource.name"
              :deniable="false"
              :modifiable="isShareModifiable(collaborator)"
              :is-share-denied="false"
              :shared-parent-route="getSharedParentRoute(collaborator)"
              :is-locked="resource.locked"
              @on-delete="confirming = collaborator.id"
            />
            <div
              v-if="confirming === collaborator.id"
              class="share-modal-confirm oc-flex oc-flex-middle oc-p-s oc-mb-xs oc-rounded"
              role="alert"
            >
              <span
                class="share-modal-confirm-text"
                v-text="
                  $gettext('Remove access for %{name}?', {
                    name: collaborator.sharedWith.displayName
                  })
                "
              />
              <oc-button size="small" appearance="raw" @click="confirming = null">
                <span v-text="$gettext('Cancel')" />
              </oc-button>
              <oc-button
                size="small"
                variation="danger"
                appearance="filled"
                class="oc-ml-s"
                @click="confirm(() => removeShare(collaborator))"
              >
                <span v-text="$gettext('Remove')" />
              </oc-button>
            </div>
          </li>
          <li v-if="peopleFilter && !filteredCollaborators.length" class="oc-py-s oc-text-muted">
            <span v-text="$gettext('Nobody matches the filter.')" />
          </li>
        </ul>

        <template v-if="spaceMembers.length">
          <h3
            class="oc-text-bold oc-text-medium oc-mt-l oc-mb-s"
            v-text="$gettext('Space members')"
          />
          <ul class="oc-list oc-list-divider" :aria-label="$gettext('Space members')">
            <li v-for="member in spaceMembers" :key="member.id">
              <collaborator-list-item
                :share="member"
                :resource-name="resource.name"
                :modifiable="false"
                :is-space-share="true"
              />
            </li>
          </ul>
        </template>
      </template>

      <h3 class="oc-text-bold oc-text-medium oc-mt-l oc-mb-s" v-text="$gettext('Public links')" />
      <!-- eslint-disable vue/no-v-html -- the message comes from the config, as HTML -->
      <p
        v-if="rwFolderWarning"
        id="files-file-link-warning"
        class="oc-mt-rm oc-mb-s oc-p-s oc-rounded"
        v-html="rwFolderWarning"
      />
      <!-- eslint-enable vue/no-v-html -->
      <ul
        v-if="directLinks.length"
        id="files-links-list"
        class="oc-list oc-list-divider share-modal-links"
        :aria-label="$gettext('Public links')"
      >
        <li v-for="link in directLinks" :key="link.key" class="oc-py-xs">
          <link-list-item
            :can-rename="true"
            :is-folder-share="resource.isFolder"
            :is-modifiable="canEditLink(link)"
            :is-password-enforced="isPasswordEnforcedForLinkType(link.type)"
            :is-password-removable="canDeletePublicLinkPassword(link)"
            :link-share="link"
            @update-link="handleLinkUpdate"
            @remove-public-link="confirming = link.id"
          />
          <div
            v-if="confirming === link.id"
            class="share-modal-confirm oc-flex oc-flex-middle oc-p-s oc-mt-xs oc-rounded"
            role="alert"
          >
            <span
              class="share-modal-confirm-text"
              v-text="$gettext('Delete this link? The same link cannot be made again.')"
            />
            <oc-button size="small" appearance="raw" @click="confirming = null">
              <span v-text="$gettext('Cancel')" />
            </oc-button>
            <oc-button
              size="small"
              variation="danger"
              appearance="filled"
              class="oc-ml-s"
              @click="confirm(() => removeLink(link))"
            >
              <span v-text="$gettext('Delete')" />
            </oc-button>
          </div>
        </li>
      </ul>
      <p v-else class="oc-text-muted oc-my-s" v-text="noLinksLabel" />
      <oc-button
        v-if="canCreateLinks"
        class="share-modal-create-link oc-mt-s"
        appearance="raw"
        variation="primary"
        @click="addNewLink"
      >
        <oc-icon name="add" />
        <span
          v-text="directLinks.length ? $gettext('Create another link') : $gettext('Create a link')"
        />
      </oc-button>

      <template v-if="indirectLinks.length">
        <h4
          class="oc-text-bold oc-text-small oc-mt-m oc-mb-s"
          v-text="$gettext('Links on parent folders')"
        />
        <ul class="oc-list oc-list-divider" :aria-label="$gettext('Links on parent folders')">
          <li v-for="link in indirectLinks" :key="link.key" class="oc-py-xs">
            <link-list-item
              :is-folder-share="resource.isFolder"
              :is-modifiable="false"
              :link-share="link"
            />
          </li>
        </ul>
      </template>
    </template>

    <div class="share-modal-actions oc-flex oc-flex-middle oc-mt-l">
      <oc-button
        v-if="!loading && (directLinks.length || canCreateLinks)"
        class="share-modal-copy-link"
        appearance="outline"
        @click="copyLink"
      >
        <oc-icon name="link" fill-type="line" />
        <span v-text="$gettext('Copy link')" />
      </oc-button>
      <oc-button
        class="share-modal-done"
        variation="primary"
        appearance="filled"
        @click="removeModal(modal.id)"
      >
        <span v-text="$gettext('Done')" />
      </oc-button>
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  PropType,
  provide,
  readonly,
  ref,
  unref,
  watch
} from 'vue'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import { isProjectSpaceResource, Resource, SpaceResource } from '@ownclouders/web-client'
import {
  Modal,
  useCanShare,
  useClipboard,
  useLoadShares,
  useMessages,
  useModals,
  useSpacesStore,
  useUserStore
} from '@ownclouders/web-pkg'
import InviteCollaboratorForm from '../SideBar/Shares/Collaborators/InviteCollaborator/InviteCollaboratorForm.vue'
import CollaboratorListItem from '../SideBar/Shares/Collaborators/ListItem.vue'
import LinkListItem from '../SideBar/Shares/Links/ListItem.vue'
import SpaceMembers from '../SideBar/Shares/SpaceMembers.vue'
import { useCollaboratorShares, useLinkShares } from '../../composables'
import { closeMenuOnEscape, keepFocusInModal } from '../../helpers/ui'

export default defineComponent({
  name: 'ShareModal',
  components: { InviteCollaboratorForm, CollaboratorListItem, LinkListItem, SpaceMembers },
  props: {
    modal: { type: Object as PropType<Modal>, required: true },
    space: { type: Object as PropType<SpaceResource>, required: true },
    resource: { type: Object as PropType<Resource>, required: true }
  },
  setup(props) {
    const { $gettext } = useGettext()
    const { removeModal } = useModals()
    const { canShare } = useCanShare()
    const { user } = storeToRefs(useUserStore())
    const { getSpaceMembers } = useSpacesStore()

    const resource = computed(() => props.resource)
    const space = computed(() => props.space)

    const { loadSharesTask, availableInternalShareRoles, availableExternalShareRoles } =
      useLoadShares({ space })
    const { collaborators, isShareModifiable, getSharedParentRoute, removeShare } =
      useCollaboratorShares({ resource, space })
    const linkShares = useLinkShares({ resource, space })
    const { showMessage, showErrorMessage } = useMessages()
    const { copyToClipboard } = useClipboard()

    // the share components were written for the sidebar, which provided these
    provide('resource', resource)
    provide('space', space)
    provide('availableInternalShareRoles', readonly(availableInternalShareRoles))
    provide('availableExternalShareRoles', readonly(availableExternalShareRoles))

    onMounted(() => loadSharesTask.perform(unref(resource)))
    // The role dropdown picks its default role when it mounts, so the form waits for the roles.
    const loading = computed(() => !loadSharesTask.performCount || loadSharesTask.isRunning)

    const owner = computed(() => unref(resource).owner || unref(user))

    // a project space has members instead of shares, and its files list them too
    const isSpace = computed(() => isProjectSpaceResource(unref(resource)))
    const spaceMembers = computed(() =>
      isProjectSpaceResource(unref(space)) && unref(space).isMember(unref(user))
        ? getSpaceMembers(unref(space))
        : []
    )

    // long lists of people get a filter, and the list scrolls (see the styles)
    const peopleFilterMin = 5
    const peopleFilter = ref('')
    const filteredCollaborators = computed(() => {
      // the clear button of the input sets null
      const term = (unref(peopleFilter) ?? '').trim().toLowerCase()
      if (!term) {
        return unref(collaborators)
      }
      return unref(collaborators).filter(({ sharedWith }) =>
        [sharedWith.displayName, sharedWith.id].some((value) => value?.toLowerCase().includes(term))
      )
    })

    // Removing a share or a link is confirmed in its row, so the dialog stays in place.
    // The id of the share or link that waits for confirmation:
    const confirming = ref<string>(null)
    const dialog = ref<HTMLElement>()
    watch(confirming, async (id) => {
      if (id) {
        await nextTick()
        unref(dialog)?.querySelector<HTMLElement>('.share-modal-confirm button')?.focus()
      }
    })
    const confirm = async (action: () => Promise<void>) => {
      confirming.value = null
      await action()
    }

    // Escape cancels a confirmation first, then closes menus, then the dialog
    const onEscape = (event: KeyboardEvent) => {
      if (unref(confirming)) {
        event.stopPropagation()
        confirming.value = null
        return
      }
      closeMenuOnEscape(event)
    }

    const noSharePermsMessage = computed(() =>
      unref(resource).isFolder
        ? $gettext("You don't have permission to share this folder.")
        : $gettext("You don't have permission to share this file.")
    )

    // copies the newest link, or creates one (the create action copies it)
    const copyLink = async () => {
      const [link] = unref(linkShares.directLinks)
      if (!link) {
        return linkShares.addNewLink()
      }
      try {
        await copyToClipboard(link.webUrl)
        showMessage({ title: $gettext('The link has been copied to your clipboard.') })
      } catch (e) {
        console.error(e)
        showErrorMessage({ title: $gettext('Failed to copy the link'), errors: [e] })
      }
    }

    return {
      ...linkShares,
      dialog,
      copyLink,
      onEscape,
      keepFocusInModal,
      removeModal,
      canShare,
      user,
      loading,
      owner,
      isSpace,
      spaceMembers,
      collaborators,
      peopleFilterMin,
      peopleFilter,
      filteredCollaborators,
      confirming,
      confirm,
      isShareModifiable,
      getSharedParentRoute,
      removeShare,
      noSharePermsMessage
    }
  }
})
</script>

<style lang="scss">
.oc-modal.share-modal {
  max-width: 640px;
}
</style>

<style lang="scss" scoped>
// the role drops are placed at the left of their positioned parent
.share-modal {
  position: relative;
}

// about six people, then the list scrolls, so the links stay close
.share-modal-people {
  max-height: 340px;
  overflow-y: auto;
}

.share-modal-owner-role {
  margin-left: auto;
}

.share-modal-confirm {
  background-color: var(--oc-color-background-muted);

  &-text {
    flex: 1;
  }
}

.share-modal-done {
  margin-left: auto;
}

#files-file-link-warning {
  border: 1px solid var(--oc-color-swatch-danger-muted);
  color: var(--oc-color-swatch-danger-default);
}
</style>
