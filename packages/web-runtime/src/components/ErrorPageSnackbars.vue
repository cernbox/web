<template>
  <div class="snackbars">
    <portal-target name="app.runtime.errorPages" />
    <message-bar />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import MessageBar from './MessageBar.vue'

export default defineComponent({
  name: 'ErrorPageSnackbars',
  components: {
    MessageBar
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
