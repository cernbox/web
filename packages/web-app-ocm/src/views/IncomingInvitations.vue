<template>
  <div id="incoming" class="sciencemesh-app">
    <div>
      <div class="oc-flex oc-flex-middle oc-px-m oc-pt-s">
        <oc-icon name="user-received" />
        <h2 class="oc-px-s" v-text="$gettext('Accept invitations')" />
        <oc-contextual-helper class="oc-pl-xs" v-bind="helperContent" />
      </div>
      <div class="oc-flex oc-flex-column oc-flex-middle oc-flex-center oc-p-m">
        <div class="oc-width-1-2">
          <oc-text-input
            v-model="token"
            :label="$gettext('Enter invite token')"
            :clear-button-enabled="true"
            class="oc-mb-s"
            @update:model-value="decodeInviteToken"
          />
          <div
            :class="{
              'oc-text-input-danger': providerError && token,
              'oc-text-input-success': provider
            }"
          >
            <span v-text="$gettext('Institution:')" />
            <span v-if="!token" v-text="'-'" />
            <span v-else-if="provider" v-text="provider" />
            <span v-else v-text="$gettext('invalid invite token')" />
          </div>
        </div>
        <oc-button
          size="small"
          :disabled="acceptInvitationButtonDisabled"
          class="oc-mt-s"
          @click="acceptInvite"
        >
          <oc-icon name="add" />
          <span v-text="$gettext('Accept invitation')" />
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useInvitationAcceptance } from '../composables/useInvitationAcceptance'

export default defineComponent({
  emits: ['highlightNewConnections'],
  setup(props, { emit }) {
    const { $gettext } = useGettext()
    const { acceptInvitation, isAccepting } = useInvitationAcceptance()

    const token = ref<string>(undefined)
    const decodedToken = ref<string>(undefined)
    const provider = ref<string>(undefined)
    const providerError = ref(false)

    const helperContent = computed(() => {
      return {
        text: $gettext(
          'Once you accept the invitation, the inviter will be added to your connections.'
        ),
        title: $gettext('Accepting invitations')
      }
    })

    const acceptInvitationButtonDisabled = computed(() => {
      return !unref(decodedToken) || !unref(provider) || unref(isAccepting)
    })

    const acceptInvite = async () => {
      const success = await acceptInvitation(unref(decodedToken), unref(provider))
      if (success) {
        token.value = undefined
        provider.value = undefined
        decodedToken.value = undefined
        emit('highlightNewConnections')
      }
    }

    const decodeInviteToken = (value: string) => {
      try {
        // Support both plain token@provider format and base64 encoded
        let decoded = value.trim()
        if (!decoded.includes('@')) {
          // Try base64 decode
          decoded = atob(decoded)
        }

        if (!decoded.includes('@')) {
          throw new Error()
        }

        const [tokenPart, serverUrl] = decoded.split('@')
        provider.value = serverUrl
        decodedToken.value = tokenPart
        providerError.value = false
      } catch (e) {
        provider.value = ''
        decodedToken.value = ''
        providerError.value = true
      }
    }

    return {
      helperContent,
      token,
      provider,
      providerError,
      acceptInvitationButtonDisabled,
      acceptInvite,
      decodeInviteToken
    }
  }
})
</script>

<style lang="scss">
.sciencemesh-app {
  .option {
    display: block;
  }

  .vs__selected,
  .options-wrapper {
    max-width: 100%;
  }

  .vs__selected-options {
    max-width: 100%;
    overflow: hidden;
  }
}
</style>
