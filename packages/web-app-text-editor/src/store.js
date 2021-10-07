const namespaced = true

const state = {
  touched: null,
  loading: false,
  isPublicLink: false,
  plToken: null,
  currentETag: null,
  currentFile: '',
  lastError: null,
  text: null,
  isReadOnly: true
}

// TODO pl with password protection

const getContents = (state, client) => {
  if (state.isPublicLink) {
    return new Promise((resolve) => {
      client.publicFiles.download(state.plToken, state.currentFile)
        .then(async res => {
          res.statusCode = res.status
          resolve({
            response: res,
            body: await res.text(),
            headers: {
              ETag: res.headers.get('etag'),
              'OC-FileId': res.headers.get('oc-fileid')
            }
          })
        })
    })
  } else {
    return client.files
      .getFileContents(state.currentFile, { resolveWithResponseObject: true, noCache: true })
  }
}

const putContents = (state, client) => {
  if (state.isPublicLink) {
    return client.publicFiles
      .putFileContents(state.plToken, state.currentFile, null, state.text, {
        previousEntityTag: state.currentETag
      })
  } else {
    return client.files
      .putFileContents(state.currentFile, state.text, {
        previousEntityTag: state.currentETag
      })
  }
}

const actions = {
  updateText({ commit }, text) {
    commit('TOUCHED', true)
    commit('UPDATE_TEXT', text)
  },
  clearLastError({ commit }) {
    commit('ERROR', '')
  },
  loadFile({ commit, state }, payload) {
    const client = payload.client

    let filePath
    if (payload.public) {
      let path = payload.filePath.split('/')
      path.shift() // remove empty first elem
      const token = path.shift()
      commit('PL_TOKEN', token)
      commit('PUBLIC_LINK', true)
      filePath = '/' + path.join('/')
    } else {
      filePath = payload.filePath
    }

    commit('LOADING', true)
    commit('CURRENT_FILE', filePath)
    getContents(state, client)
      .then((resp) => {
        commit('CURRENT_ETAG', resp.headers.ETag)
        commit('UPDATE_TEXT', resp.body)
        commit('LOADING', false)
      })
      .catch((error) => {
        commit('ERROR', error.message || error)
        commit('LOADING', false)
      })
  },
  saveFile({ commit, state }, payload) {
    commit('LOADING', true)
    putContents(state, payload.client)
      .then((resp) => {
        commit('CURRENT_ETAG', resp.ETag)

        // get etag & update
        commit('TOUCHED', false)
        commit('LOADING', false)
      })
      .catch((error) => {
        commit('ERROR', error.message || error)
        commit('LOADING', false)
      })
  },
  resetState({ commit }) {
    commit('TOUCHED', false)
    commit('LOADING', false)
    commit('CURRENT_ETAG', null)
    commit('UPDATE_TEXT', null)
    commit('CURRENT_FILE', '')
  },
  setWriteMode({ commit }) {
    commit('WRITE_MODE')
  }
}

const mutations = {
  TOUCHED(state, flag) {
    state.touched = flag
  },
  LOADING(state, loading) {
    state.loading = loading
  },
  UPDATE_TEXT(state, text) {
    state.text = text
  },
  CURRENT_ETAG(state, etag) {
    state.currentETag = etag
  },
  CURRENT_FILE(state, filePath) {
    state.currentFile = filePath
  },
  ERROR(state, errorMessage) {
    state.lastError = errorMessage
  },
  PUBLIC_LINK(state, flag) {
    state.isPublicLink = flag
  },
  PL_TOKEN(state, token) {
    state.plToken = token
  },
  WRITE_MODE(state) {
    state.isReadOnly = false
  }
}

const getters = {
  isTouched: (state) => {
    return state.touched
  },
  isLoading: (state) => {
    return state.loading
  },
  currentContent: (state) => {
    return state.text
  },
  lastError: (state) => {
    return state.lastError
  },
  isReadOnly: (state) => {
    return state.isReadOnly
  },
  currentFile: (state) => {
    return state.currentFile
  },
  isPublicLink: (state) => {
    return state.isPublicLink
  },
  plToken: (state) => {
    return state.plToken
  }
}

export default {
  namespaced,
  state,
  actions,
  mutations,
  getters
}
