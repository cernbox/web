<template>
  <img
    ref="img"
    :key="`media-image-${file.id}`"
    :src="file.url"
    :alt="file.name"
    :data-id="file.id"
    :style="`transform: rotate(${currentImageRotation}deg)`"
  />
</template>
<script lang="ts">
import { CachedFile } from '../../helpers/types'
import { defineComponent, PropType, onMounted, ref, watch, unref, nextTick } from 'vue'
import type { PanzoomObject, PanzoomOptions } from '@panzoom/panzoom'
import Panzoom from '@panzoom/panzoom'

export default defineComponent({
  name: 'MediaImage',
  props: {
    file: {
      type: Object as PropType<CachedFile>,
      required: true
    },
    currentImageZoom: {
      type: Number,
      required: true
    },
    currentImageRotation: {
      type: Number,
      required: true
    },
    currentImagePositionX: {
      type: Number,
      required: true
    },
    currentImagePositionY: {
      type: Number,
      required: true
    }
  },
  emits: ['panZoomChange'],
  setup(props, { emit }) {
    const img = ref<HTMLElement | null>()
    const panzoom = ref<PanzoomObject | undefined>()

    const onPanZoomChange = (event: Event) => {
      emit('panZoomChange', event)
    }

    const destroyPanzoom = () => {
      const el = unref(img) as unknown as HTMLElement
      el?.removeEventListener('panzoomchange', onPanZoomChange)
      unref(panzoom)?.destroy()
      panzoom.value = undefined
      if (el) {
        el.style.transform = `rotate(${props.currentImageRotation}deg)`
      }
    }

    const createPanzoom = async () => {
      await nextTick()
      panzoom.value = Panzoom(unref(img), {
        animate: false,
        duration: 300,
        overflow: 'auto',
        maxScale: 10,
        setTransform: (_, { scale, x, y }) => {
          let h: number
          let v: number

          switch (props.currentImageRotation) {
            case -270:
            case 90:
              h = y
              v = 0 - x
              break
            case -180:
            case 180:
              h = 0 - x
              v = 0 - y
              break
            case -90:
            case 270:
              h = 0 - y
              v = x
              break
            default:
              h = x
              v = y
          }

          unref(panzoom).setStyle(
            'transform',
            `rotate(${props.currentImageRotation}deg) scale(${scale}) translate(${h}px, ${v}px)`
          )
        }
      } as PanzoomOptions)
      ;(unref(img) as unknown as HTMLElement).addEventListener('panzoomchange', onPanZoomChange)
    }

    const initPanzoom = async () => {
      destroyPanzoom()
      if (props.currentImageZoom > 1) {
        await createPanzoom()
        unref(panzoom).zoom(props.currentImageZoom)
      }
    }

    watch(img, initPanzoom)
    onMounted(initPanzoom)

    watch([() => props.currentImageZoom, () => props.currentImageRotation], async () => {
      if (props.currentImageZoom === 1) {
        destroyPanzoom()
      } else {
        if (!unref(panzoom)) {
          await createPanzoom()
        }
        unref(panzoom).zoom(props.currentImageZoom)
      }
    })

    watch([() => props.currentImagePositionX, () => props.currentImagePositionY], () => {
      unref(panzoom)?.pan(props.currentImagePositionX, props.currentImagePositionY)
    })

    return {
      img
    }
  }
})
</script>
<style lang="scss" scoped>
img {
  object-fit: contain;
  max-width: 80%;
  max-height: 80%;
}
</style>
