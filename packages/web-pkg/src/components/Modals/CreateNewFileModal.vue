<template>
  <div class="create-new-file-modal">
    <oc-text-input
      ref="fileNameInputRef"
      v-model="fileName"
      :label="$gettext('File name')"
      :error-message="nameError"
      :selection-range="inputSelectionRange"
      :fix-message-line="true"
      :class="{ 'create-new-file-modal-name-has-app-chip': appOptions.length > 1 }"
      @update:model-value="onFileNameInput"
      @keydown.enter.prevent="onConfirm"
    >
      <template v-if="appOptions.length > 1" #suffix>
        <oc-filter-chip
          class="oc-position-center-right create-new-file-modal-app-chip"
          :filter-label="selectedOption.label"
          raw
          close-on-click
        >
          <oc-list class="create-new-file-modal-app-chip-list">
            <li v-for="option in appOptions" :key="option.appFileExtension.app">
              <oc-button
                appearance="raw"
                justify-content="space-between"
                class="oc-width-1-1 create-new-file-modal-app-chip-item"
                @click="onAppChange(option)"
              >
                <span class="oc-flex oc-flex-middle">
                  <oc-icon :name="option.icon" :fill-type="option.iconFillType" class="oc-mr-xs" />
                  <span v-text="option.label" />
                </span>
                <oc-icon
                  v-if="option.appFileExtension.app === selectedOption.appFileExtension.app"
                  name="check"
                />
              </oc-button>
            </li>
          </oc-list>
        </oc-filter-chip>
      </template>
    </oc-text-input>
    <div class="oc-flex oc-flex-right oc-flex-middle oc-mt-m">
      <div class="oc-modal-body-actions-grid">
        <oc-button
          class="oc-modal-body-actions-cancel"
          appearance="outline"
          variation="passive"
          @click="onCancel"
        >
          {{ $gettext('Cancel') }}
        </oc-button>
        <oc-button
          class="oc-modal-body-actions-confirm oc-ml-s"
          appearance="filled"
          variation="primary"
          :disabled="!!nameError"
          @click="onConfirm"
        >
          {{ $gettext('Create') }}
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, PropType, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Modal, useModals } from '../../composables/piniaStores/modals'
import { useAppsStore } from '../../composables/piniaStores'
import { ApplicationFileExtension } from '../../apps'
import { IconFillType } from '../../helpers'

type AppOption = {
  appFileExtension: ApplicationFileExtension
  label: string
  icon: string
  iconFillType?: IconFillType
}

export default defineComponent({
  name: 'CreateNewFileModal',
  props: {
    modal: { type: Object as PropType<Modal>, required: true },
    defaultName: { type: String, required: true },
    inputSelectionRange: { type: Array as unknown as PropType<[number, number]>, default: null },
    appFileExtensions: {
      type: Array as PropType<ApplicationFileExtension[]>,
      required: true
    },
    defaultAppFileExtension: { type: Object as PropType<ApplicationFileExtension>, required: true },
    getNameErrorMsg: {
      type: Function as PropType<(name: string) => string | null>,
      required: true
    },
    callbackFn: {
      type: Function as PropType<
        (fileName: string, appFileExtension: ApplicationFileExtension) => void | Promise<void>
      >,
      required: true
    }
  },
  setup(props) {
    const { removeModal } = useModals()
    const { $gettext } = useGettext()
    const appsStore = useAppsStore()

    const fileNameInputRef = ref<{ focus: () => void }>()
    const fileName = ref(props.defaultName)
    const nameError = ref<string>(props.getNameErrorMsg(props.defaultName))

    const appOptions: AppOption[] = props.appFileExtensions.map((appFileExtension) => {
      const appInfo = appsStore.apps[appFileExtension.app]
      return {
        appFileExtension,
        label: appInfo?.name || appFileExtension.app,
        icon: appFileExtension.icon || appInfo?.icon || 'file-3',
        iconFillType: appInfo?.iconFillType
      }
    })

    const selectedOption = ref<AppOption>(
      appOptions.find(
        (option) => option.appFileExtension.app === props.defaultAppFileExtension.app
      ) || appOptions[0]
    )

    const onFileNameInput = (value: string) => {
      nameError.value = props.getNameErrorMsg(value)
    }

    const onAppChange = (option: AppOption) => {
      selectedOption.value = option
    }

    const onConfirm = () => {
      if (nameError.value) {
        return
      }
      removeModal(props.modal.id)
      props.callbackFn(fileName.value, selectedOption.value.appFileExtension)
    }

    const onCancel = () => {
      removeModal(props.modal.id)
    }

    onMounted(() => {
      fileNameInputRef.value?.focus()
    })

    return {
      $gettext,
      fileNameInputRef,
      fileName,
      nameError,
      appOptions,
      selectedOption,
      onFileNameInput,
      onAppChange,
      onConfirm,
      onCancel
    }
  }
})
</script>

<style lang="scss" scoped>
.create-new-file-modal-name-has-app-chip :deep(.oc-text-input) {
  padding-right: 160px;
}

.create-new-file-modal-app-chip {
  max-width: 150px;

  :deep(.oc-drop) {
    width: 220px;
  }
}

.create-new-file-modal-app-chip-item:hover {
  background-color: var(--oc-color-background-hover);
}
</style>
