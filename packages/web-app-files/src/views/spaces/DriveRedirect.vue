<template>
  <div class="oc-flex oc-width-1-1">
    <no-content-message
      v-if="spaceNotFound"
      id="files-space-not-found"
      class="oc-width-1-1"
      icon="layout-grid"
    >
      <template #message>
        <span v-text="$gettext('Space not found')" />
      </template>

      <template #callToAction>
        <oc-button
          id="space-not-found-button-go-spaces"
          type="router-link"
          appearance="raw"
          class="oc-mt-s"
          :to="spacesRoute"
        >
          <span v-translate>Go to »Spaces Overview«</span>
        </oc-button>
      </template>
    </no-content-message>

    <app-loading-spinner v-else-if="areSpacesLoading" />
  </div>
</template>

<script lang="ts" setup>
import { computed, unref, watchEffect } from 'vue'
import {
  NoContentMessage,
  useRoute,
  useRouter,
  useSpacesLoading,
  useSpacesStore
} from '@ownclouders/web-pkg'
import { AppLoadingSpinner } from '@ownclouders/web-pkg'
import { urlJoin } from '@ownclouders/web-client'
import { createFileRouteOptions } from '@ownclouders/web-pkg'
import { createLocationSpaces } from '@ownclouders/web-pkg'
import { RouteLocationRaw } from 'vue-router'

// 'personal/home' is used as personal drive alias from static contexts
// (i.e. places where we can't load the actual personal space)
const fakePersonalDriveAlias = 'personal/home'

const { driveAliasAndItem = '' } = defineProps<{
  driveAliasAndItem?: string
}>()

const router = useRouter()
const route = useRoute()
const spacesStore = useSpacesStore()
const { areSpacesLoading } = useSpacesLoading()

const personalSpace = computed(() => {
  return spacesStore.spaces.find((space) => space.driveType === 'personal')
})

const spacesRoute = computed(() => createLocationSpaces('files-spaces-projects'))

const isPersonalAlias = computed(
  () =>
    driveAliasAndItem.startsWith(fakePersonalDriveAlias) ||
    driveAliasAndItem === 'personal' ||
    driveAliasAndItem === ''
)

const spaceNotFound = computed(() => {
  if (unref(areSpacesLoading)) return false
  return !unref(isPersonalAlias) || !unref(personalSpace)
})

watchEffect(() => {
  if (unref(areSpacesLoading)) return
  if (!unref(isPersonalAlias)) return
  if (!unref(personalSpace)) return

  const itemPath = driveAliasAndItem.startsWith(fakePersonalDriveAlias)
    ? urlJoin(driveAliasAndItem.slice(fakePersonalDriveAlias.length))
    : '/'

  const { params, query } = createFileRouteOptions(unref(personalSpace), {
    path: itemPath
  })

  const { fullPath, ...routeWithoutFullPath } = unref(route)

  router
    .replace({
      ...routeWithoutFullPath,
      path: fullPath,
      params: {
        ...routeWithoutFullPath.params,
        ...params
      },
      query
    } as RouteLocationRaw)
    // avoid NavigationDuplicated error in console
    .catch(() => {})
})
</script>
