<template>
  <main>
    <h1>Hello</h1>
  </main>
</template>

<script>

import * as THREE from 'three';

export default {
  name: 'IFCEditor',
  data() {
    return {
      camera: null,
      scene: null,
      renderer: null
    }
  },
  methods: {
    init: function() {
      this.scene = new THREE.Scene()
      this.camera = new THREE.PerspectiveCamera(75,
        window.innerWidth/window.innerHeight, 0.1, 1000)
      this.renderer = new THREE.WebGLRenderer()
      renderer.setSize(window.innerWidth, window.innerHeight)
      document.body.appendChild(renderer.domElement)
    },
    animate: function() {
      requestAnimationFrame(this.animate)
      this.renderer.render(this.scene, this.camera)
    }
  },
  mounted() {
    this.init()
    this.animate()
  }
}
</script>