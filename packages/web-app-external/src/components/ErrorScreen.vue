<template>
  <div class="uk-text-center">
    <oc-icon size="xxlarge" name="warning" />
    <p v-translate>Error when loading the application</p>
    <p v-if="message">{{ message }}</p>
  </div>
</template>
