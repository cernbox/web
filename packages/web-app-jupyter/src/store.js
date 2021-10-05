import * as ipynb2html from 'ipynb2html'

const namespaced = true

const state = {
  loading: false,
  currentFile: '',
  lastError: null,
  notebook: null
}

const actions = {
  clearLastError({ commit }) {
    commit('ERROR', '')
  },
  loadFile({ commit }, payload) {
    const filePath = payload.filePath
    const client = payload.client

    commit('LOADING', true)
    commit('CURRENT_FILE', filePath)
    client.files
      .getFileContents(filePath)
      .then((resp) => {
        const jsonResponse = JSON.parse(resp)
        const notebookHtml = ipynb2html.render(jsonResponse)
        commit('UPDATE_NOTEBOOK', notebookHtml.innerHTML)
        commit('LOADING', false)
      })
      .catch((error) => {
        commit('ERROR', error.message || error)
        commit('LOADING', false)
      })
  }
}

const mutations = {
  LOADING(state, loading) {
    state.loading = loading
  },
  UPDATE_NOTEBOOK(state, notebook) {
    state.notebook = notebook
  },
  CURRENT_FILE(state, filePath) {
    state.currentFile = filePath
  },
  ERROR(state, errorMessage) {
    state.lastError = errorMessage
  }
}

const getters = {
  isLoading: (state) => {
    return state.loading
  },
  renderedNotebook: (state) => {
    return state.notebook
  },
  lastError: (state) => {
    return state.lastError
  }
}

export default {
  namespaced,
  state,
  actions,
  mutations,
  getters
}
