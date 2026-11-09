<script lang="ts">
import { computed, defineComponent, PropType, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { SpaceResource } from '@ownclouders/web-client'
import { useResourcesStore, useSelectedResources, useSideBarDialogs } from '../../composables'

/**
 * CERNBox has no file sidebar: what opened it opens dialogs instead (see useSideBarDialogs).
 * The views and apps still mount this component, because it knows their space.
 */
export default defineComponent({
  name: 'FileSideBar',
  props: {
    isOpen: {
      type: Boolean,
      required: true
    },
    activePanel: {
      type: String,
      required: false,
      default: null
    },
    space: {
      type: Object as PropType<SpaceResource>,
      required: false,
      default: null
    }
  },
  setup(props) {
    const { currentFolder } = storeToRefs(useResourcesStore())
    const { selectedResources } = useSelectedResources()

    useSideBarDialogs({
      space: computed(() => props.space),
      // with nothing selected, the dialogs show the current folder
      items: computed(() => {
        if (unref(selectedResources).length) {
          return unref(selectedResources)
        }
        return unref(currentFolder)?.id ? [unref(currentFolder)] : []
      })
    })
  },
  render: () => null
})
</script>
