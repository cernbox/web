<template>
  <div class="oc-width-1-1">
    <not-found-message v-if="showNotFound" />
    <app-loading-spinner v-else />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, unref, watchEffect } from 'vue'
import { useRoute, useRouter, useSpacesLoading, useSpacesStore } from '@ownclouders/web-pkg'
import { AppLoadingSpinner } from '@ownclouders/web-pkg'
import { urlJoin } from '@ownclouders/web-client'
import { createFileRouteOptions } from '@ownclouders/web-pkg'
import NotFoundMessage from '../../components/FilesList/NotFoundMessage.vue'

// 'personal/home' is used as personal drive alias from static contexts
// (i.e. places where we can't load the actual personal space)
const fakePersonalDriveAlias = 'personal/home'

export default defineComponent({
  name: 'DriveRedirect',
  components: {
    AppLoadingSpinner,
    NotFoundMessage
  },
  props: {
    driveAliasAndItem: {
      type: String,
      required: false,
      default: ''
    }
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    const spacesStore = useSpacesStore()
    const { areSpacesLoading } = useSpacesLoading()
    const showNotFound = ref(false)

    const personalSpace = computed(() => {
      return spacesStore.spaces.find((space) => space.driveType === 'personal')
    })

    const isPersonalAlias = computed(() => {
      return (
        props.driveAliasAndItem.startsWith(fakePersonalDriveAlias) ||
        props.driveAliasAndItem === 'personal' ||
        props.driveAliasAndItem === ''
      )
    })

    const itemPath = computed(() => {
      return urlJoin(props.driveAliasAndItem.slice(fakePersonalDriveAlias.length))
    })

    watchEffect(() => {
      if (unref(areSpacesLoading)) {
        showNotFound.value = false
        return
      }

      if (unref(isPersonalAlias) && unref(personalSpace)) {
        showNotFound.value = false
        const { params, query } = createFileRouteOptions(unref(personalSpace), {
          path: unref(itemPath)
        })

        router
          .replace({
            ...unref(route),
            params: {
              ...unref(route).params,
              ...params
            },
            query
          })
          // avoid NavigationDuplicated error in console
          .catch(() => {})
        return
      }

      showNotFound.value = !unref(isPersonalAlias) || !unref(personalSpace)
    })

    return { showNotFound }
  }
})
</script>
