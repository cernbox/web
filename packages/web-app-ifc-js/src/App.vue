<template>
<canvas id="threeCanvas"></canvas>
</template>

<script>
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { IFCLoader } from "web-ifc-three/IFCLoader"

export default {
  name: 'IFCEditor',
  data() {
    return {
      camera: null,
      scene: null,
      renderer: null,
      controls: null
    }
  },
  methods: {
    init: function() {
      const threeCanvas = document.getElementById('threeCanvas')
      
      this.scene = new THREE.Scene()
      const lightColor = 0xffffff

      const ambientLight = new THREE.AmbientLight(lightColor, 0.5)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(lightColor, 1)
      directionalLight.position.set(0, 10, 0)
      directionalLight.target.position.set(-5, 0, 0)
      this.scene.add(directionalLight)
      this.scene.add(directionalLight.target)

      this.camera = new THREE.PerspectiveCamera(75, threeCanvas.clientWidth/threeCanvas.clientHeight)
      this.camera.position.z = 15
      this.camera.position.y = 13
      this.camera.position.x = 8
      
      this.renderer = new THREE.WebGLRenderer({canvas: threeCanvas, alpha: true})
      this.renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      this.controls = new OrbitControls(this.camera, threeCanvas)
      this.controls.enableDamping = true
      this.controls.target.set(-2, 0, 0)
    },
    addGrid: function() {
      const grid = new THREE.GridHelper(50, 30)
      this.scene.add(grid)
    },
    addAxes: function() {
      const axes = new THREE.AxesHelper()
      axes.material.depthTest = false
      axes.renderOrder = 1
      this.scene.add(axes)
    },
    animate: function() {
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      requestAnimationFrame(this.animate)
    },
    addIFCModel: function() {
      const ifcLoader = new IFCLoader()

      console.log("vasco 7")
      ifcLoader.ifcManager.setWasmPath("./")
      const url = this.$client.files.getFileUrl(this.$route.params.filePath)
      console.log("vasco 8")
      ifcLoader.load(url, (ifcModel) => this.scene.add(ifcModel.mesh))
      console.log("vasco 9", url)
    }
  },
  mounted() {
    console.log("vasco", IFCLoader)
    this.init()
    console.log("vasco 1")
    this.addGrid()
    console.log("vasco 2")
    this.addAxes()
    console.log("vasco 3")
    this.animate()
    console.log("vasco 4")
    this.addIFCModel()
    console.log("vasco 5")
  }
}
</script>

<style>
  #threeCanvas {width: 100%; height: 100%}
</style>