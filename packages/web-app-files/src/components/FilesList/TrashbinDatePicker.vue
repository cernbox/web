<template>
  <div class="oc-flex oc-flex-row trashbin-datepicker">
    <date-picker
      v-model="rangeSelected"
      :min-date="dateMin"
      :max-date="dateNow"
      :locale="currentLanguage"
      :is-range="true"
      timezone="utc"
      class="oc-datepicker"
      data-testid="trashbin-datepicker"
    >
      <template #default="{ togglePopover }">
        <oc-button
          class="oc-p-m action-menu-item"
          data-testid="trashbin-datepicker-btn"
          appearance="raw"
          :aria-label="
            rangeSelected ? $gettext('Edit time interval') : $gettext('Set time interval')
          "
          @click="togglePopover"
        >
          <oc-icon name="calendar-event" fill-type="line" size="medium" variation="passive" />
          <span
            v-if="!rangeSelected"
            key="no-selected-date-label"
            v-text="$gettext('Set time interval')"
          />
          <span v-else key="set-selected-date-label" v-text="formatRange(rangeSelected)" />
        </oc-button>
      </template>
      <template #day-popover> </template>
    </date-picker>
  </div>
</template>

<script lang="ts">
import { DateTime } from 'luxon'
import { Ref, ref, unref, watch, defineComponent } from 'vue'
import { getLocaleFromLanguage } from '@ownclouders/web-pkg'
import { useRouteQuery, queryItemAsString } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { DatePicker } from 'v-calendar'
import 'v-calendar/style.css'

export default defineComponent({
  name: 'TrashbinDatePicker',
  components: {
    DatePicker
  },
  props: {},
  emits: ['rangeChanged'],
  setup(props, { emit }) {
    const { current: currentLanguage } = useGettext()
    const fromQuery = useRouteQuery('from')
    const toQuery = useRouteQuery('to')

    const locale = getLocaleFromLanguage(currentLanguage)
    const dateNow = DateTime.now().setLocale(locale)
    const dateMin = dateNow.minus({ week: 6 })
    const defaultStart = dateNow.minus({ days: 2 })

    interface Range {
      start: Date
      end: Date
    }

    const rangeSelected: Ref<Range> = ref(
      unref(fromQuery) && unref(toQuery)
        ? {
            start: new Date(queryItemAsString(unref(fromQuery))),
            end: new Date(queryItemAsString(unref(toQuery)))
          }
        : {
            start: defaultStart.toJSDate(),
            end: dateNow.toJSDate()
          }
    )

    watch(rangeSelected, (newRange, oldRange) => {
      if (newRange?.start && newRange?.end) {
        const from = newRange.start.toISOString().slice(0, 10)
        const to = newRange.end.toISOString().slice(0, 10)
        fromQuery.value = from
        toQuery.value = to
        emit('rangeChanged', { range: { from, to } })
      }
    })

    function formatDate(date: Date) {
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear().toString().slice(-2)

      return `${day}-${month}-${year}`
    }

    function formatRange(range) {
      return `${formatDate(new Date(range.start))} - ${formatDate(new Date(range.end))}`
    }

    // No need to add default values, as the backend will apply them
    // onMounted(() => {
    //   if (!unref(rangeSelected)) {
    //     rangeSelected.value = {
    //     start: defaultStart.toJSDate(),
    //     end: dateNow.toJSDate()
    //   }
    //   }
    // })

    return {
      currentLanguage,
      rangeSelected,
      dateMin,
      dateNow,
      formatDate,
      formatRange
    }
  }
})
</script>

<style lang="scss">
.trashbin-datepicker {
  width: fit-content;
}
.vc-pane-layout {
  color: var(--oc-color-text-default) !important;
  background-color: var(--oc-color-background-default) !important;
}
.vc-arrow {
  background: transparent;
}
.vc-arrow svg path {
  fill: var(--oc-color-text-default) !important;
}
.vc-title {
  color: var(--oc-color-text-default) !important;
  background-color: transparent !important;
  font-size: var(--text-lg);
}
.vc-weekday {
  color: var(--oc-color-text-muted) !important;
}
.vc-day {
  color: var(--oc-color-text-default) !important;
}

.vc-highlights {
  .vc-highlight {
    background-color: var(--oc-color-swatch-primary-default) !important;
  }
  + span {
    color: var(--oc-color-text-inverse) !important;
  }
}

.vc-day-content.is-disabled {
  color: var(--oc-color-text-muted) !important;
}
</style>
