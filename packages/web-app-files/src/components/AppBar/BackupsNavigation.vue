<template>
  <nav id="backups-navigation" class="oc-py-s" :aria-label="$gettext('Backups pages navigation')">
    <oc-list class="oc-flex oc-visible@s">
      <li v-for="navItem in navItems" :key="`backups-navigation-desktop-${navItem.to}`">
        <oc-button
          type="router-link"
          class="oc-mr-m oc-py-s backups-nav-desktop"
          appearance="raw"
          :to="navItem.to"
        >
          <oc-icon size="small" :name="navItem.icon" />
          <span v-text="navItem.text" />
        </oc-button>
      </li>
    </oc-list>
    <div class="oc-hidden@s">
      <oc-button id="backups_navigation_mobile" appearance="raw">
        <span v-text="currentNavItem.text" />
        <oc-icon name="arrow-down-s" fill-type="line" size="small" />
      </oc-button>
      <oc-drop toggle="#backups_navigation_mobile" mode="click" close-on-click padding-size="small">
        <oc-list>
          <li v-for="navItem in navItems" :key="`backups-navigation-mobile-${navItem.to}`">
            <oc-button
              type="router-link"
              class="oc-my-xs backups-nav-mobile"
              appearance="raw"
              :to="navItem.to"
              :class="{ 'oc-background-primary-gradient': navItem.active }"
              :variation="navItem.active ? 'inverse' : 'passive'"
            >
              <span class="icon-box" :class="{ 'icon-box-active': navItem.active }">
                <oc-icon :name="navItem.icon" />
              </span>
              <span v-text="navItem.text" />
            </oc-button>
          </li>
        </oc-list>
      </oc-drop>
    </div>
  </nav>
</template>

<script>
import {
  locationBackupsMe,
  locationBackupsProjects,
  isLocationCommonActive
} from '../../router/common'
import { computed, getCurrentInstance, unref } from '@vue/composition-api'
import { useRouter } from 'web-pkg/src/composables'
import { useActiveLocation } from '../../composables'

export default {
  setup() {
    const $gettext = getCurrentInstance().proxy.$gettext
    const router = useRouter()
    const backupsRoutes = [locationBackupsMe, locationBackupsProjects].reduce((routes, route) => {
      routes[route.name] = router.getRoutes().find((r) => r.name === route.name)
      return routes
    }, {})
    const BackupsMeActive = useActiveLocation(isLocationCommonActive, locationBackupsMe.name)
    const BackupsProjectsActive = useActiveLocation(
      isLocationCommonActive,
      locationBackupsProjects.name
    )

    const navItems = computed(() => [
      {
        icon: 'arrow-go-back',
        to: backupsRoutes[locationBackupsMe.name].path,
        text: $gettext('My backups'),
        active: unref(BackupsMeActive)
      },
      {
        icon: 'arrow-go-back',
        to: backupsRoutes[locationBackupsProjects.name].path,
        text: $gettext('Project backups'),
        active: unref(BackupsProjectsActive)
      }
    ])
    const currentNavItem = computed(() => unref(navItems).find((navItem) => navItem.active))
    return {
      currentNavItem,
      navItems
    }
  }
}
</script>
<style lang="scss" scoped>
#backups-navigation {
  a {
    gap: var(--oc-space-medium);
    width: 100%;

    &:focus,
    &:hover {
      text-decoration: none;
    }

    &.backups-nav-mobile {
      justify-content: flex-start;
    }

    .icon-box {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
    }
    .icon-box-active {
      box-shadow: 2px 0 6px rgba(0, 0, 0, 0.14);
    }
  }

  .backups-nav-desktop.router-link-active {
    border-bottom: 2px solid var(--oc-color-swatch-primary-default) !important;
    border-radius: 0;
  }
}
</style>
