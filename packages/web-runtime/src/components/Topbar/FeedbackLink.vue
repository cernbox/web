<template>
  <div class="oc-flex">
    <oc-button
      id="cernbox-feedback-button"
      v-oc-tooltip="description"
      type="a"
      :href="href"
      target="_blank"
      appearance="raw"
      variation="inverse"
      :aria-label="ariaLabel"
      aria-describedby="oc-feedback-link-description"
    >
      <oc-icon name="feedback" />
    </oc-button>
    <p id="oc-feedback-link-description" class="oc-invisible-sr" v-text="description" />
  </div>
</template>

<script>
export default {
  name: 'FeedbackLink',
  computed: {
    href() {
      return 'https://codimd.web.cern.ch/TKGx1_6nQMK2OEHfmQ4XUQ'
    },
    ariaLabel() {
      return this.$gettext('Give Us Feedback')
    },
    description() {
      return this.$gettext(
        'This version is still in development and your feedback is very important to us! Please add your comments in the following document.'
      )
    }
  }
}
</script>
