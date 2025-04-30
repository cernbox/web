<template>
  <div class="oc-my-s oc-flex oc-flex-row oc-width-large" style="align-items: center">
    <span>Filter by project: </span>
    <oc-select
      v-model="selectedProject"
      class="oc-mx-s oc-width-medium"
      :multiple="false"
      :searchable="true"
      option-label="name"
      :options="projectOptions"
      @option:selected="projectSelected"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useAccessToken, useStore } from 'web-pkg/src/composables'

const projectOptions = []

export default defineComponent({
  name: 'ProjectPicker',
  props: {},
  emits: ['projectSelected'],

  setup(props, { emit }) {
    const store = useStore()
    const accessToken = useAccessToken({ store })

    return {
      accessToken
    }
  },

  data() {
    return {
      selectedProject: {},
      projectOptions
    }
  },

  created() {
    if (this.projectOptions.length === 0) {
      this.projectOptions.push({
        name: 'My files',
        path: ''
      })
    }

    this.getAllowedProjects(this.accessToken).then((projects: { name: string; path: string }[]) => {
      this.projectOptions = this.projectOptions.concat(...projects)
      if (localStorage.getItem('project-picked')) {
        this.selectedProject = this.projectOptions.find(
          (project: { name: string; path: string }) =>
            project.path.split('/').pop() === localStorage.getItem('project-picked')
        )
      } else {
        this.selectedProject = this.projectOptions.find(
          (project: { name: string; path: string }) => project.name === 'My files'
        )
      }
      this.projectSelected(this.selectedProject)
    })
  },

  methods: {
    projectSelected(newValue: { name: string; path: string }) {
      this.selectedProject = newValue
      const project = newValue.path.split('/').pop()
      localStorage.setItem('project-picked', project)
      this.$emit('projectSelected', project)
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
      data.projects.forEach((project: { name: string; path: string }) => {
        projects.push({
          name: project.name,
          path: project.path
        })
      })
      return projects
    },

    async getProjectsFilter() {
      const response = await fetch('projects_filter.json')
      if (!response.ok) {
        const message = `An error has occured: ${response.status}`
        throw new Error(message)
      }
      const projects = await response.json()
      return projects
    },

    async getAllowedProjects(accessToken: string) {
      const projects = await this.getProjects(accessToken)
      const allowedProjects = await this.getProjectsFilter()
      const filteredProjects = projects.filter((project: { name: string }) =>
        allowedProjects.includes(project.name)
      )
      return filteredProjects
    }
  }
})
</script>
