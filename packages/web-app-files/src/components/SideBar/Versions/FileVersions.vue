<template>
  <div id="oc-file-versions-sidebar">
    <ul v-if="versions.length" class="oc-list oc-list-divider oc-m-rm">
      <li
        v-for="(item, index) in versions"
        :key="index"
        class="version-item oc-flex oc-flex-middle oc-py-xs"
      >
        <div class="version-details oc-text-truncate">
          <span
            v-oc-tooltip="formatVersionDate(item)"
            class="version-date oc-font-semibold"
            data-testid="file-versions-file-last-modified-date"
            >{{ formatVersionDateRelative(item) }}</span
          >
          <span
            class="version-filesize oc-text-muted oc-ml-s"
            data-testid="file-versions-file-size"
            >{{ formatVersionFileSize(item) }}</span
          >
        </div>
        <oc-button
          v-if="isRevertible"
          data-testid="file-versions-revert-button"
          appearance="raw"
          :aria-label="$gettext('Restore')"
          class="version-action-item oc-rounded oc-py-xs oc-px-s"
          @click="revertToVersion(item)"
        >
          <oc-icon name="history" fill-type="line" size="small" />
          {{ $gettext('Restore') }}
        </oc-button>
        <oc-button
          data-testid="file-versions-download-button"
          appearance="raw"
          :aria-label="$gettext('Download')"
          class="version-action-item oc-rounded oc-py-xs oc-px-s"
          @click="downloadVersion(item)"
        >
          <oc-icon name="file-download" fill-type="line" size="small" />
          {{ $gettext('Download') }}
        </oc-button>
      </li>
    </ul>
    <div v-else>
      <p v-translate data-testid="file-versions-no-versions">No versions available for this file</p>
    </div>
  </div>
</template>
<script lang="ts">
import { DavPermission } from '@ownclouders/web-client/webdav'
import {
  formatRelativeDateFromHTTP,
  formatDateFromJSDate,
  formatFileSize,
  useClientService,
  useDownloadFile,
  useResourcesStore,
  useMessages
} from '@ownclouders/web-pkg'
import { computed, defineComponent, inject, Ref, unref } from 'vue'
import { isShareSpaceResource, Resource, SpaceResource } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'

export default defineComponent({
  name: 'FileVersions',
  props: {
    isReadOnly: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  setup(props) {
    const clientService = useClientService()
    const language = useGettext()
    const { $gettext } = language
    const { downloadFile } = useDownloadFile({ clientService })
    const { updateResourceField } = useResourcesStore()
    const { showMessage, showErrorMessage } = useMessages()

    const space = inject<Ref<SpaceResource>>('space')
    const resource = inject<Ref<Resource>>('resource')
    const versions = inject<Ref<Resource[]>>('versions')

    const isRevertible = computed(() => {
      if (props.isReadOnly) {
        return false
      }

      if (isShareSpaceResource(unref(space)) || unref(resource).isReceivedShare()) {
        if (unref(resource).permissions !== undefined) {
          return unref(resource).permissions.includes(DavPermission.Updateable)
        }
      }

      return true
    })

    const revertToVersion = async (version: Resource) => {
      try {
        await clientService.webdav.restoreFileVersion(unref(space), unref(resource), version.name)
        showMessage({ title: $gettext('Version was successfully restored') })
      } catch (error) {
        showErrorMessage({
          title: $gettext('Error restoring file version'),
          errors: [error]
        })
      }
      const restoredResource = await clientService.webdav.getFileInfo(unref(space), unref(resource))

      const fieldsToUpdate = ['size', 'mdate'] as const
      for (const field of fieldsToUpdate) {
        if (Object.prototype.hasOwnProperty.call(unref(resource), field)) {
          updateResourceField({
            id: unref(resource).id,
            field: field,
            value: restoredResource[field]
          })
        }
      }
    }
    const downloadVersion = (version: Resource) => {
      return downloadFile(unref(space), unref(resource), version.name)
    }
    const formatVersionDateRelative = (version: Resource) => {
      return formatRelativeDateFromHTTP(version.mdate, language.current)
    }
    const formatVersionDate = (version: Resource) => {
      return formatDateFromJSDate(new Date(version.mdate), language.current)
    }
    const formatVersionFileSize = (version: Resource) => {
      return formatFileSize(version.size, language.current)
    }

    return {
      space,
      resource,
      versions,
      isRevertible,
      revertToVersion,
      downloadVersion,
      formatVersionDateRelative,
      formatVersionDate,
      formatVersionFileSize
    }
  }
})
</script>

<style lang="scss" scoped>
// one line for each version, so that ten versions still fit in the details dialog
.version-details {
  flex: 1;
}

button.version-action-item {
  &:hover {
    color: var(--oc-color-primary-contrast);
    background-color: var(--oc-color-background-hover);
  }
}
</style>
