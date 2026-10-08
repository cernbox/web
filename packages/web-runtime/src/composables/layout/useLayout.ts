import LayoutPlain from '../../layouts/Plain.vue'
import LayoutApplication from '../../layouts/Application.vue'
import { computed, unref } from 'vue'
import { Router } from 'vue-router'
import { useRouter, AuthStore, WebRouteMeta, layoutTypes, LayoutType } from '@ownclouders/web-pkg'

export interface LayoutOptions {
  authStore?: AuthStore
  router?: Router
}

export const useLayout = (options?: LayoutOptions) => {
  const router = options?.router || useRouter()

  const layoutType = computed<LayoutType>(() => {
    const plainLayoutRoutes = [
      'login',
      'logout',
      'oidcCallback',
      'oidcSilentRedirect',
      'oidcPopupCallback',
      'resolvePublicLink',
      'accessDenied'
    ]
    const currentRoute = unref(router.currentRoute)
    const routeLayout = (currentRoute.meta as WebRouteMeta)?.layout
    if (layoutTypes.includes(routeLayout)) {
      return routeLayout
    }
    if (!currentRoute.name || plainLayoutRoutes.includes(currentRoute.name as string)) {
      return 'plain'
    }

    return 'application'
  })

  const layout = computed(() => {
    switch (unref(layoutType)) {
      case 'application':
        return LayoutApplication
      case 'plain':
      default:
        return LayoutPlain
    }
  })

  return {
    layoutType,
    layout
  }
}
