<template>
  <div class="oc-my-s oc-flex oc-flex-row oc-width-large" style="align-items: center">
    <span>Filter by project: </span>
    <oc-select
      v-model="selectedProjects"
      class="oc-mx-s oc-width-medium"
      :multiple="true"
      :searchable="true"
      option-label="name"
      :options="projectOptions"
      @option:selected="projectsSelected"
      @option:deselected="projectRemoved"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useAccessToken, useStore } from 'web-pkg/src/composables'

const projectOptions = []
const lastProjectsPicked = localStorage.getItem('projects-picked') || false

export default defineComponent({
  name: 'ProjectPicker',
  props: {},
  emits: ['projectSelected'],

  setup(props, { emit }) {
    const store = useStore()
    const accessToken = useAccessToken({ store })

    projectOptions.push({
      name: 'My files',
      path: ''
    })

    return {
      accessToken
    }
  },

  data() {
    return {
      selectedProjects: [],
      projectOptions,
      lastProjectsPicked
    }
  },

  created() {
    this.getProjects(this.accessToken).then((projects: { name: string; path: string }[]) => {
      let loadedOptions = projects.map((project: { name: string; path: string }) => ({
        name: project.name,
        path: project.path
      }))
      this.projectOptions = this.projectOptions.concat(...loadedOptions)
      if (this.lastProjectsPicked) {
        this.selectedProjects.push(
          ...this.projectOptions.filter((project: { name: string; path: string }) =>
            JSON.parse(this.lastProjectsPicked).includes(project.path.split('/').pop())
          )
        )
      } else {
        this.selectedProjects.push(
          this.projectOptions.find(
            (project: { name: string; path: string }) => project.name === 'My files'
          )
        )
      }
      this.projectsSelected(this.selectedProjects)
    })
  },

  methods: {
    projectsSelected(newValue: { name: string; path: string }[]) {
      if (newValue.length === 0) {
        this.selectedProjects.push(
          this.projectOptions.find(
            (project: { name: string; path: string }) => project.name === 'My files'
          )
        )
      } else {
        this.selectedProjects = newValue
      }
      const projects = newValue.map((project: { name: string; path: string }) =>
        project.path.split('/').pop()
      )
      localStorage.setItem('projects-picked', JSON.stringify(projects))
      this.$emit('projectSelected', projects)
    },

    projectRemoved(project: { name: string; path: string }) {
      if (project.name === 'My files') {
        this.selectedProjects.unshift(
          this.projectOptions.find(
            (project: { name: string; path: string }) => project.name === 'My files'
          )
        )
      } else {
        this.projectsSelected(this.selectedProjects)
      }
    },

    async getProjects(accessToken: string) {
      const headers = new Headers()
      headers.append('Authorization', 'Bearer ' + accessToken)
      headers.append('X-Requested-With', 'XMLHttpRequest')
      const response = await fetch('api/v0/projects', {
        method: 'GET',
        headers
      })
      if (!response.ok) {
        const message = `An error has occured: ${response.status}`
        throw new Error(message)
      }
      const data = await response.json()

      let projects = []
      data.projects.forEach((project) => {
        projects.push({
          name: project.name,
          path: project.path
        })
      })

      return projects
    }
  }
})
</script>
