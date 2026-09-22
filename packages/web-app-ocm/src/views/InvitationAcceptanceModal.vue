<template>
  <oc-modal
    :title="$gettext('Accept Invitation')"
    :button-cancel-text="$gettext('Cancel')"
    :button-confirm-text="$gettext('Accept')"
    :button-confirm-disabled="isAccepting"
    @cancel="$emit('cancel')"
    @confirm="handleAccept"
  >
    <template #content>
      <div class="oc-flex oc-flex-column">
        <p v-text="$gettext('You are about to accept an invitation from:')" />
        <div class="oc-my-s">
          <strong v-text="$gettext('Provider:')" />
          <span class="oc-ml-s" v-text="providerDomain" />
        </div>
        <div class="oc-mb-s">
          <strong v-text="$gettext('Token:')" />
          <span class="oc-ml-s oc-text-truncate" v-text="token" />
        </div>
        <p
          v-text="$gettext('Once accepted, you will be able to share files with this provider.')"
        />
      </div>
    </template>
  </oc-modal>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useInvitationAcceptance } from '../composables/useInvitationAcceptance'

export default defineComponent({
  name: 'InvitationAcceptanceModal',
  props: {
    token: {
      type: String,
      required: true
    },
    providerDomain: {
      type: String,
      required: true
    }
  },
  emits: ['cancel', 'accepted'],
  setup(props, { emit }) {
    const { isAccepting, acceptInvitation } = useInvitationAcceptance()

    const handleAccept = async () => {
      const success = await acceptInvitation(props.token, props.providerDomain)
      if (success) {
        emit('accepted')
      }
    }

    return {
      isAccepting,
      handleAccept
    }
  }
})
</script>
