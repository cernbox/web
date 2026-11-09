<template>
  <div
    class="details-modal"
    data-testid="details-modal"
    @keydown.esc="closeMenuOnEscape"
    @focusout="keepFocusInModal"
  >
    <oc-loader v-if="!loadedResource" :aria-label="$gettext('Loading details')" />
    <space-details v-else-if="isSpace" />
    <template v-else>
      <div
        v-if="hasVersions"
        class="details-modal-tabs oc-flex oc-mb-m"
        role="tablist"
        :aria-label="$gettext('Details and versions')"
      >
        <oc-button
          v-for="tab in tabs"
          :id="`details-modal-tab-${tab.id}`"
          :key="tab.id"
          role="tab"
          appearance="raw"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`details-modal-panel-${tab.id}`"
          class="details-modal-tab oc-py-s oc-px-m"
          :class="{ 'details-modal-tab-active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span v-text="tab.label" />
        </oc-button>
      </div>
      <div class="details-modal-panels">
        <div
          id="details-modal-panel-details"
          role="tabpanel"
          aria-labelledby="details-modal-tab-details"
          :class="{ 'details-modal-panel-hidden': activeTab !== 'details' }"
        >
          <file-details :tags-enabled="tagsEnabled" compact-header />
          <section v-if="showImageInfo" class="oc-mt-l">
            <h3 class="oc-text-bold oc-text-medium oc-mb-s" v-text="$gettext('Image Info')" />
            <exif-panel />
          </section>
          <section v-if="showAudioInfo" class="oc-mt-l">
            <h3 class="oc-text-bold oc-text-medium oc-mb-s" v-text="$gettext('Audio Info')" />
            <audio-meta-panel />
          </section>
        </div>
        <file-versions
          v-if="hasVersions"
          id="details-modal-panel-versions"
          role="tabpanel"
          aria-labelledby="details-modal-tab-versions"
          :class="{ 'details-modal-panel-hidden': activeTab !== 'versions' }"
        />
      </div>
    </template>

    <div class="details-modal-actions oc-flex oc-mt-l">
      <oc-button
        class="details-modal-close"
        variation="primary"
        appearance="filled"
        @click="removeModal(modal.id)"
      >
        <span v-text="$gettext('Close')" />
      </oc-button>
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  PropType,
  provide,
  readonly,
  ref,
  unref,
  watch
} from 'vue'
import { useGettext } from 'vue3-gettext'
import { isEmpty } from 'lodash-es'
import { isProjectSpaceResource, Resource, SpaceResource } from '@ownclouders/web-client'
import {
  eventBus,
  isLocationSharesActive,
  isLocationTrashActive,
  Modal,
  SideBarEventTopics,
  SpaceDetails,
  useCanListVersions,
  useClientService,
  useExtensionRegistry,
  useGetMatchingSpace,
  useModals,
  useRouter
} from '@ownclouders/web-pkg'
import FileDetails from '../SideBar/Details/FileDetails.vue'
import ExifPanel from '../SideBar/Exif/ExifPanel.vue'
import AudioMetaPanel from '../SideBar/Audio/AudioMetaPanel.vue'
import FileVersions from '../SideBar/Versions/FileVersions.vue'
import { closeMenuOnEscape, keepFocusInModal } from '../../helpers/ui'

export default defineComponent({
  name: 'DetailsModal',
  components: { FileDetails, ExifPanel, AudioMetaPanel, FileVersions, SpaceDetails },
  props: {
    modal: { type: Object as PropType<Modal>, required: true },
    space: { type: Object as PropType<SpaceResource>, required: true },
    resource: { type: Object as PropType<Resource>, required: true }
  },
  setup(props) {
    const router = useRouter()
    const clientService = useClientService()
    const { removeModal } = useModals()
    const extensionRegistry = useExtensionRegistry()
    const { canListVersions } = useCanListVersions()
    const { isPersonalSpaceRoot } = useGetMatchingSpace()

    const { $gettext } = useGettext()
    const space = computed(() => props.space)
    const loadedResource = ref<Resource>()
    const versions = ref<Resource[]>([])

    // the panels were written for the sidebar, which provided these
    provide('resource', readonly(loadedResource))
    provide('space', space)
    provide('versions', readonly(versions))

    const loadResource = async () => {
      if (!isLocationSharesActive(router)) {
        loadedResource.value = props.resource
        return
      }
      // shares look different, so the actual resource is fetched
      try {
        const webDavResource = await clientService.webdav.getFileInfo(props.space, {
          path: props.resource.path
        })
        loadedResource.value = {
          ...webDavResource,
          ...props.resource,
          tags: webDavResource.tags
        }
      } catch (error) {
        loadedResource.value = props.resource
        console.error(error)
      }
    }
    loadResource()

    const showVersions = computed(() =>
      canListVersions({ space: props.space, resource: props.resource })
    )
    const loadVersions = async () => {
      if (!unref(showVersions)) {
        return
      }
      try {
        versions.value = await clientService.webdav.listFileVersions(props.resource.id)
      } catch (error) {
        console.error(error)
      }
    }
    // restoring a version changes the resource's mdate in the store
    watch(() => props.resource.mdate, loadVersions, { immediate: true })

    // the versions are a tab, so the dialog does not grow with them
    const hasVersions = computed(() => unref(showVersions) && unref(versions).length > 0)
    const activeTab = ref<'details' | 'versions'>('details')
    const tabs = computed(() => [
      { id: 'details' as const, label: $gettext('Details') },
      {
        id: 'versions' as const,
        label: $gettext('Versions (%{count})', { count: unref(versions).length.toString() })
      }
    ])

    // The versions count in the details and the members count in the space details link to
    // sidebar panels: show the versions tab, and open the members as the sidebar would.
    const versionsPanelToken = eventBus.subscribe(
      SideBarEventTopics.setActivePanel,
      (panel: string) => {
        if (panel === 'space-share') {
          // without the members dialog, the members would open these details again
          const [membersDialog] = extensionRegistry.requestExtensions({
            id: 'global.files.space-members-dialog',
            extensionType: 'customComponent'
          })
          if (membersDialog) {
            eventBus.publish(SideBarEventTopics.openWithPanel, panel)
          }
          return
        }
        if (panel === 'versions') {
          activeTab.value = 'versions'
        }
      }
    )
    onBeforeUnmount(() => {
      eventBus.unsubscribe(SideBarEventTopics.setActivePanel, versionsPanelToken)
    })

    const tagsEnabled = computed(
      () =>
        !isPersonalSpaceRoot(props.resource) &&
        !isLocationTrashActive(router, 'files-trash-generic')
    )
    const showImageInfo = computed(
      () =>
        props.resource.type === 'file' &&
        (!isEmpty(props.resource.image) || !isEmpty(props.resource.photo))
    )
    const showAudioInfo = computed(
      () => props.resource.type === 'file' && !isEmpty(props.resource.audio)
    )
    const isSpace = computed(() => isProjectSpaceResource(props.resource))

    return {
      isSpace,
      removeModal,
      closeMenuOnEscape,
      keepFocusInModal,
      loadedResource,
      hasVersions,
      activeTab,
      tabs,
      tagsEnabled,
      showImageInfo,
      showAudioInfo
    }
  }
})
</script>

<style lang="scss">
.oc-modal.details-modal {
  max-width: 600px;
}
</style>

<style lang="scss" scoped>
.details-modal-tabs {
  border-bottom: 1px solid var(--oc-color-border);
}

.details-modal-tab {
  border-bottom: 2px solid transparent;
  border-radius: 0;
  margin-bottom: -1px;

  &-active {
    border-bottom-color: var(--oc-color-swatch-primary-default);
    font-weight: bold;
  }
}

// both tabs share one grid cell, so the dialog keeps its height when the tab changes
.details-modal-panels {
  display: grid;

  > * {
    grid-area: 1 / 1;
  }
}

.details-modal-panel-hidden {
  visibility: hidden;
}

.details-modal-close {
  margin-left: auto;
}
</style>
