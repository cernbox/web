<template>
  <div class="oc-height-1-1" tabindex="0">
    <app-loading-spinner v-if="isLoading" />
    <iframe
      v-show="!isLoading"
      ref="iframeRef"
      class="oc-width-1-1 oc-height-1-1"
      :title="iframeTitle"
      :src="iframeSrc"
      tabindex="0"
      @load="onLoad"
    ></iframe>
  </div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, PropType, ref } from 'vue'
import {
  LocationQuery,
  Modal,
  useModals,
  useRouter,
  useThemeStore,
  embedModeFilePickMessageData
} from '../../composables'
import { Resource } from '@ownclouders/web-client'
import { RouteLocationRaw } from 'vue-router'
import AppLoadingSpinner from '../AppLoadingSpinner.vue'
import { unref } from 'vue'

export default defineComponent({
  name: 'FilePickerModal',
  components: { AppLoadingSpinner },
  props: {
    modal: { type: Object as PropType<Modal>, required: true },
    allowedFileTypes: { type: Array as PropType<string[]>, default: () => [] },
    parentFolderLink: { type: Object as PropType<RouteLocationRaw>, required: true },
    callbackFn: {
      type: Function as PropType<
        (payload: { resource: Resource; locationQuery?: LocationQuery }) => void
      >,
      required: true
    }
  },
  setup(props) {
    const iframeRef = ref<HTMLIFrameElement>()
    const isLoading = ref(true)
    const router = useRouter()
    const { removeModal } = useModals()
    const themeStore = useThemeStore()
    const parentFolderRoute = router.resolve(props.parentFolderLink)

    const iframeTitle = themeStore.currentTheme.common?.name
    const iframeUrl = new URL(parentFolderRoute.href, window.location.origin)
    iframeUrl.searchParams.append('hide-logo', 'true')
    iframeUrl.searchParams.append('embed', 'true')
    iframeUrl.searchParams.append('embed-target', 'file')
    iframeUrl.searchParams.append('embed-delegate-authentication', 'false')
    iframeUrl.searchParams.append('embed-file-types', props.allowedFileTypes.join(','))

    const onLoad = () => {
      isLoading.value = false
      unref(iframeRef).contentWindow.focus()
    }

    const onFilePick = ({ data }: MessageEvent) => {
      if (data.name !== 'owncloud-embed:file-pick') {
        return
      }

      const { resource, locationQuery }: embedModeFilePickMessageData = data.data

      removeModal(props.modal.id)
      props.callbackFn({ resource, locationQuery })
    }

    const onCancel = ({ data }: MessageEvent) => {
      if (data.name !== 'owncloud-embed:cancel') {
        return
      }

      removeModal(props.modal.id)
    }

    onMounted(() => {
      window.addEventListener('message', onFilePick)
      window.addEventListener('message', onCancel)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('message', onFilePick)
      window.removeEventListener('message', onCancel)
    })

    return {
      isLoading,
      onLoad,
      iframeTitle,
      iframeSrc: iframeUrl.href,
      iframeRef,
      onFilePick
    }
  }
})
</script>

<style lang="scss">
.oc-modal.open-with-app-modal {
  max-width: 80vw;
  border: none;
  overflow: hidden;

  .oc-modal-title {
    display: none;
  }

  .oc-modal-body {
    padding: 0;

    &-message {
      height: 60vh;
      margin: 0;
    }
  }
}
</style>
