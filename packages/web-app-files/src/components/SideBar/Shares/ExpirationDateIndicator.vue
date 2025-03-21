<template>
  <div class="oc-flex oc-flex-center expiration-date-indicator">
    <oc-icon
      v-oc-tooltip="expirationDateTooltip"
      :aria-label="expirationDateTooltip"
      name="calendar-event"
      :color="isExpired ? 'var(--oc-color-swatch-danger-muted)' : ''"
      fill-type="line"
    />
    <span class="oc-invisible-sr" v-text="screenreaderShareExpiration" />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, unref } from 'vue'
import { DateTime } from 'luxon'
import { formatDateFromDateTime, formatRelativeDateFromDateTime } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

export default defineComponent({
  name: 'ExpirationDateIndicator',
  props: {
    expirationDate: { type: Object as PropType<DateTime>, required: false, default: null }
  },
  setup(props) {
    const { $gettext, current: currentLanguage } = useGettext()

    const isExpired = computed(() => {
      return props.expirationDate.endOf('day') < DateTime.now().endOf('day')
    })

    const expirationDateRelative = computed(() => {
      return formatRelativeDateFromDateTime(props.expirationDate, currentLanguage)
    })

    const dateExpire = computed(() => {
      return formatDateFromDateTime(props.expirationDate, currentLanguage)
    })

    const expirationDateTooltip = computed(() => {
      const expire = unref(isExpired) ? 'Expired' : 'Expires'

      return $gettext(
        `${expire} %{timeToExpiry} (%{expiryDate})`,
        { timeToExpiry: unref(expirationDateRelative), expiryDate: unref(dateExpire) },
        true
      )
    })

    const screenreaderShareExpiration = computed(() => {
      const expire = unref(isExpired) ? 'expired' : 'expires'

      return $gettext(`Share ${expire} %{ expiryDateRelative } (%{ expiryDate })`, {
        expiryDateRelative: unref(expirationDateRelative),
        expiryDate: unref(dateExpire)
      })
    })

    return {
      isExpired,
      expirationDateTooltip,
      screenreaderShareExpiration
    }
  }
})
</script>
