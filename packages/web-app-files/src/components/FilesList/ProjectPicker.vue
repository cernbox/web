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
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import { defineComponent, unref } from 'vue'

const projectOptions = []

export default defineComponent({
  name: 'ProjectPicker',
  props: {},
  emits: ['projectSelected'],

  setup(props, { emit }) {
    const spacesStore = useSpacesStore()
    const clientService = useClientService()

    return {
      spacesStore,
      clientService
    }
  },

  data() {
    return {
      selectedProject: {
        name: '',
        path: null
      },
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
    this.getAllowedProjects().then((projects: { name: string; path: string }[]) => {
      const loadedOptions = projects.map((project: { name: string; path: string }) => ({
        name: project.name,
        path: project.path
      }))
      this.projectOptions = this.projectOptions.concat(...loadedOptions)
      if (localStorage.getItem('project-picked')) {
        this.selectedProject = this.projectOptions.find(
          (project: { name: string; path: string }) =>
            project.path.split('/').pop() === localStorage.getItem('project-picked')
        )
      } else {
        this.selectedProject = this.projectOptions.find(
          (project: { name: string; path: string }) => project.name === 'My files'
        )
        this.projectSelected(this.selectedProject)
      }
    })
  },

  methods: {
    projectSelected(newValue: { name: string; path: string }) {
      this.selectedProject = newValue
      const project = newValue.path.split('/').pop()
      localStorage.setItem('project-picked', project)
      this.$emit('projectSelected', project)
    },
    async getProjects() {
      await this.spacesStore.reloadProjectSpaces({
        graphClient: this.clientService.graphAuthenticated,
        isInVault: false
      })
      const projects = []
      unref(this.spacesStore.spaces).forEach((project) => {
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

    async getAllowedProjects() {
      const projects = await this.getProjects()
      const allowedProjects = await this.getProjectsFilter()
      const filteredProjects = projects.filter((project: { name: string }) =>
        allowedProjects.includes(project.name)
      )
      return filteredProjects
    }
  }
})
</script>
