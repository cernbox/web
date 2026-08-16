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
<script lang="ts" setup>
import { CachedFile } from '../../helpers/types'
import { onMounted, ref, watch, unref, nextTick } from 'vue'
import type { PanzoomObject, PanzoomOptions } from '@panzoom/panzoom'
import Panzoom from '@panzoom/panzoom'

interface Props {
  file: CachedFile
  currentImageZoom: number
  currentImageRotation: number
  currentImagePositionX: number
  currentImagePositionY: number
}
interface Emits {
  (e: 'panZoomChange', event: Event): void
}
const {
  file,
  currentImageZoom,
  currentImageRotation,
  currentImagePositionX,
  currentImagePositionY
} = defineProps<Props>()
const emit = defineEmits<Emits>()
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
    el.style.transform = `rotate(${currentImageRotation}deg)`
  }
}

const createPanzoom = async () => {
  // wait for next tick until image is rendered
  await nextTick()

  panzoom.value = Panzoom(unref(img), {
    animate: false,
    duration: 300,
    overflow: 'auto',
    maxScale: 10,
    setTransform: (_, { scale, x, y }) => {
      let h: number
      let v: number

      switch (currentImageRotation) {
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
        `rotate(${currentImageRotation}deg) scale(${scale}) translate(${h}px, ${v}px)`
      )
    }
  } as PanzoomOptions)
  ;(unref(img) as unknown as HTMLElement).addEventListener('panzoomchange', onPanZoomChange)
}

// Panzoom captures pointer events and shows a move cursor even when the image
// fits, so keep it uninstantiated while at natural size.
const initPanzoom = async () => {
  destroyPanzoom()
  if (currentImageZoom > 1) {
    await createPanzoom()
    unref(panzoom).zoom(currentImageZoom)
  }
}

watch(img, initPanzoom)
onMounted(initPanzoom)

watch([() => currentImageZoom, () => currentImageRotation], async () => {
  if (currentImageZoom === 1) {
    destroyPanzoom()
  } else {
    if (!unref(panzoom)) {
      await createPanzoom()
    }
    unref(panzoom).zoom(currentImageZoom)
  }
})

watch([() => currentImagePositionX, () => currentImagePositionY], () => {
  unref(panzoom)?.pan(currentImagePositionX, currentImagePositionY)
})
</script>
<style lang="scss" scoped>
img {
  object-fit: contain;
  max-width: 80%;
  max-height: 80%;
}
</style>
