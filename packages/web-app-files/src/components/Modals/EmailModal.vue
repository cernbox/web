<template>
  <oc-text-input
    :model-value="email"
    :label="$gettext('Email')"
    type="email"
    :error-message="errorMessage"
    class="oc-modal-body-input"
    @keydown.enter.prevent="$emit('confirm')"
    @update:model-value="onInput"
  />
  <div class="link-modal-actions oc-flex oc-flex-right oc-flex-middle oc-mt-s">
    <oc-button
      class="oc-modal-body-actions-cancel oc-ml-s"
      appearance="outline"
      variation="passive"
      @click="$emit('cancel')"
      >{{ $gettext('Cancel') }}
    </oc-button>
    <oc-button
      :disabled="error"
      class="oc-modal-body-actions-confirm oc-ml-s"
      appearance="filled"
      variation="primary"
      @click="$emit('confirm', email)"
      >{{ $gettext('Confirm') }}
    </oc-button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, unref, PropType } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Modal } from '@ownclouders/web-pkg'
import * as EmailValidator from 'email-validator'

export default defineComponent({
  name: 'EmailModal',
  props: {
    modal: { type: Object as PropType<Modal>, required: true },
    initialEmail: { type: Object as PropType<string>, required: false, default: '' }
  },
  emits: ['confirm'],
  setup(props) {
    const { $gettext } = useGettext()

    const email = ref(props.initialEmail)
    const error = ref(props.initialEmail === '')
    const errorMessage = ref<string>()

    const onInput = (value: string) => {
      email.value = value

      if (value === '') {
        error.value = true
        errorMessage.value = $gettext("Email can't be empty")
        return
      }

      if (!EmailValidator.validate(value)) {
        error.value = true
        errorMessage.value = $gettext('Please enter a valid email')
        return
      }

      error.value = false
      errorMessage.value = undefined
    }

    return {
      email,
      onInput,
      error,
      errorMessage
    }
  }
})
</script>
