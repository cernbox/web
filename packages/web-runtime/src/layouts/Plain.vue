<template>
  <div
    class="oc-login oc-height-viewport"
    :style="{ backgroundImage: 'url(' + backgroundImg + ')' }"
  >
    <h1 class="oc-invisible-sr" v-text="pageTitle" />
    <router-view />
    <div class="snackbars">
      <message-bar />
    </div>
  </div>
</template>

<script lang="ts">
import { storeToRefs } from 'pinia'
import { computed, defineComponent, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useRouteMeta, useThemeStore } from '@ownclouders/web-pkg'
import MessageBar from '../components/MessageBar.vue'

export default defineComponent({
  name: 'PlainLayout',
  components: {
    MessageBar
  },
  setup() {
    const { $gettext } = useGettext()
    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)

    const title = useRouteMeta('title')

    const pageTitle = computed(() => {
      return $gettext(unref(title) || '')
    })
    const backgroundImg = computed(() => currentTheme.value.loginPage.backgroundImg)

    return {
      pageTitle,
      backgroundImg
    }
  }
})
</script>

<style lang="scss" scoped>
.snackbars {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: calc(var(--oc-z-index-modal) + 1);

  @media (max-width: 640px) {
    left: 0;
    right: 0;
    margin: 0 auto;
    width: 100%;
    max-width: 500px;
  }
}
</style>
