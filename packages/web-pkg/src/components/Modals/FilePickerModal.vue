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

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  LocationQuery,
  Modal,
  useEmbedMode,
  useModals,
  useRouter,
  useThemeStore,
  embedModeFilePickMessageData
} from '../../composables'
import { Resource } from '@ownclouders/web-client'
import { RouteLocationRaw } from 'vue-router'
import AppLoadingSpinner from '../AppLoadingSpinner.vue'
import { unref } from 'vue'

interface Props {
  modal: Modal
  allowedFileTypes?: string[]
  parentFolderLink: RouteLocationRaw
  callbackFn: (payload: { resource: Resource; locationQuery?: LocationQuery }) => void
}
const { modal, allowedFileTypes = [], parentFolderLink, callbackFn } = defineProps<Props>()
const iframeRef = ref<HTMLIFrameElement>()
const isLoading = ref(true)
const router = useRouter()
const { removeModal } = useModals()
const themeStore = useThemeStore()
const { verifyMessageOrigin } = useEmbedMode()
const parentFolderRoute = router.resolve(parentFolderLink)

const iframeTitle = themeStore.currentTheme.common?.name
const iframeUrl = new URL(parentFolderRoute.href, window.location.origin)
iframeUrl.searchParams.append('hide-logo', 'true')
iframeUrl.searchParams.append('embed', 'true')
iframeUrl.searchParams.append('embed-target', 'file')
iframeUrl.searchParams.append('embed-delegate-authentication', 'false')
iframeUrl.searchParams.append('embed-file-types', allowedFileTypes.join(','))

const iframeSrc = iframeUrl.href

const onLoad = () => {
  isLoading.value = false
  unref(iframeRef).contentWindow.focus()
}

const onFilePick = ({ data, origin }: MessageEvent) => {
  if (!verifyMessageOrigin(origin)) {
    return
  }

  if (data.name !== 'owncloud-embed:file-pick') {
    return
  }

  const { resource, locationQuery }: embedModeFilePickMessageData = data.data

  removeModal(modal.id)
  callbackFn({ resource, locationQuery })
}

const onCancel = ({ data, origin }: MessageEvent) => {
  if (!verifyMessageOrigin(origin)) {
    return
  }

  if (data.name !== 'owncloud-embed:cancel') {
    return
  }

  removeModal(modal.id)
}

onMounted(() => {
  window.addEventListener('message', onFilePick)
  window.addEventListener('message', onCancel)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onFilePick)
  window.removeEventListener('message', onCancel)
})
</script>

<style lang="scss">
.oc-modal.open-with-app-modal {
  max-width: 80dvw;
  border: none;
  overflow: hidden;

  .oc-modal-title {
    display: none;
  }

  .oc-modal-body {
    padding: 0;

    &-message {
      height: 60dvh;
      margin: 0;
    }
  }
}
</style>
