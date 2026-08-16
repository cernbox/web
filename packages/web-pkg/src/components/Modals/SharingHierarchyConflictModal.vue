<template>
  <div class="sharing-hierarchy-conflict-modal">
    <p class="sharing-hierarchy-conflict-modal-intro oc-mb-s" v-text="intro" />
    <div
      v-if="groups.length"
      class="sharing-hierarchy-conflict-modal-list"
      data-testid="sharing-hierarchy-conflict-list"
    >
      <div
        v-for="group in groups"
        :key="group.shareeKey"
        class="sharing-hierarchy-conflict-modal-group oc-mb-s"
      >
        <p
          class="sharing-hierarchy-conflict-modal-sharee oc-text-bold oc-m-rm"
          v-text="sharedWithLabel(group)"
        />
        <ul class="sharing-hierarchy-conflict-modal-entries oc-pl-m oc-my-s">
          <li
            v-for="entry in group.entries"
            :key="entry.key"
            class="sharing-hierarchy-conflict-modal-entry"
            v-text="entryLine(entry)"
          />
        </ul>
      </div>
    </div>
    <div class="oc-flex oc-flex-right oc-flex-middle oc-mt-m">
      <div class="oc-modal-body-actions-grid">
        <oc-button
          class="oc-modal-body-actions-cancel"
          appearance="outline"
          variation="passive"
          @click="onCancel"
        >
          {{ cancelLabel }}
        </oc-button>
        <oc-button
          v-if="mode === 'confirm' || mode === 'inform-remove'"
          class="oc-modal-body-actions-confirm oc-ml-s"
          appearance="filled"
          :variation="mode === 'inform-remove' ? 'danger' : 'primary'"
          @click="onConfirm"
        >
          {{ confirmLabel }}
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { ShareRole, SharingHierarchyConflict } from '@ownclouders/web-client'
import { computed, defineComponent, PropType, toRef, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Modal, useModals } from '../../composables/piniaStores/modals'
import {
  collectConflictingShares,
  getSharingHierarchyConflictIntro,
  groupConflictingSharesBySharee,
  type ShareeConflictGroup,
  type SharingHierarchyConflictIntroVariant
} from '../../composables/shares/sharingHierarchyConflictDisplay'

export type SharingHierarchyConflictModalResult = boolean | 'remove'

export default defineComponent({
  name: 'SharingHierarchyConflictModal',
  props: {
    modal: { type: Object as PropType<Modal>, required: true },
    conflicts: {
      type: Array as PropType<SharingHierarchyConflict[]>,
      required: true
    },
    mode: {
      type: String as PropType<'confirm' | 'inform' | 'inform-remove'>,
      default: 'confirm'
    },
    introVariant: {
      type: String as PropType<SharingHierarchyConflictIntroVariant>,
      default: 'default'
    },
    resourcePath: {
      type: String,
      default: undefined
    },
    graphRoles: {
      type: Object as PropType<Record<string, ShareRole>>,
      default: () => ({})
    },
    callbackFn: {
      type: Function as PropType<(result: SharingHierarchyConflictModalResult) => void>,
      required: true
    }
  },
  setup(props) {
    const { removeModal } = useModals()
    const { $gettext } = useGettext()

    const conflicts = toRef(props, 'conflicts')

    const intro = computed(() =>
      getSharingHierarchyConflictIntro(unref(conflicts), $gettext, props.introVariant)
    )
    const groups = computed<ShareeConflictGroup[]>(() =>
      groupConflictingSharesBySharee(
        collectConflictingShares(unref(conflicts)),
        props.resourcePath,
        props.graphRoles,
        $gettext
      )
    )

    const cancelLabel = computed(() =>
      props.mode === 'inform' || props.mode === 'inform-remove'
        ? $gettext('OK')
        : $gettext('Cancel')
    )
    const confirmLabel = computed(() => {
      if (props.mode === 'inform-remove') {
        return $gettext('Remove this share')
      }

      return unref(conflicts).length > 1 ? $gettext('Proceed with all') : $gettext('Proceed anyway')
    })

    const sharedWithLabel = (group: ShareeConflictGroup) =>
      $gettext('Shared with %{sharee}:', { sharee: group.shareeLabel })

    const entryLine = (entry: ShareeConflictGroup['entries'][number]) =>
      `(${entry.permissionLabel}) ${entry.relativePath}`

    const finish = (result: SharingHierarchyConflictModalResult) => {
      removeModal(props.modal.id)
      props.callbackFn(result)
    }

    const onConfirm = () => finish(props.mode === 'inform-remove' ? 'remove' : true)
    const onCancel = () => finish(false)

    return {
      intro,
      groups,
      cancelLabel,
      confirmLabel,
      sharedWithLabel,
      entryLine,
      onConfirm,
      onCancel
    }
  }
})
</script>

<style lang="scss" scoped>
.sharing-hierarchy-conflict-modal-list {
  max-height: 240px;
  overflow-y: auto;
  padding-right: var(--oc-space-xsmall);
}

.sharing-hierarchy-conflict-modal-entry + .sharing-hierarchy-conflict-modal-entry {
  margin-top: var(--oc-space-xsmall);
}
</style>
