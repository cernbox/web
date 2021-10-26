<template>
<div id="container"></div>
</template>

<script>
//import  * as THREE from 'https://cdn.skypack.dev/pin/three@v0.133.1-a8rkd0QTHl2tMZXZJAEw/mode=imports/optimized/three.js'
import * as THREE from "three"

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
      let container = document.getElementById('container');
      this.scene = new THREE.Scene()
      this.camera = new THREE.PerspectiveCamera(75,
        container.clientWidth / container.clientHeight, 0.1, 1000)
      this.renderer = new THREE.WebGLRenderer({antialias: true})
      this.renderer.setSize(container.clientWidth, container.clientHeight)
      container.appendChild(this.renderer.domElement);
    },
    addCube: function() {
      let geometry = new THREE.BoxGeometry(1, 1, 1);
      let material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      let cube = new THREE.Mesh(geometry, material);
      this.scene.add(cube);

      this.camera.position.z = 5;
    },
    animate: function() {
      this.renderer.render(this.scene, this.camera)
    }
  },
  mounted() {
    this.init()
    this.addCube()
    this.animate()
  }
}
</script>

<style>
  #container {width: 100%; height: 100%}
</style>