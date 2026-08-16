<template>
  <div class="oc-flex oc-flex-center expiration-date-indicator">
    <oc-icon
      v-oc-tooltip="expirationDateTooltip"
      :accessible-label="screenreaderShareExpiration"
      name="calendar-event"
      :color="isExpired ? 'var(--oc-color-swatch-danger-muted)' : ''"
      fill-type="line"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, unref } from 'vue'
import { DateTime } from 'luxon'
import { formatDateFromDateTime, formatRelativeDateFromDateTime } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

interface Props {
  expirationDate?: DateTime
}
const { expirationDate = null } = defineProps<Props>()
const { $gettext, current: currentLanguage } = useGettext()

const isExpired = computed(() => {
  return expirationDate?.endOf('day') < DateTime.now().endOf('day')
})

const expirationDateRelative = computed(() => {
  return formatRelativeDateFromDateTime(expirationDate, currentLanguage)
})

const dateExpire = computed(() => {
  return formatDateFromDateTime(expirationDate, currentLanguage)
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
</script>
