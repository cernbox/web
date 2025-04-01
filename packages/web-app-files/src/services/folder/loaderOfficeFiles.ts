import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { buildResource } from 'web-client/src/helpers'
import { isLocationCommonActive } from '../../router'
import { xml2js } from 'xml-js'

export class OfficeFilesLoader implements FolderLoader {
  public isEnabled(): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    return isLocationCommonActive(router, 'files-common-office')
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const {
      store,
      clientService: { owncloudSdk: client }
    } = context

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return useTask(function* (signal1, signal2, extensionFilter: string, projectNames: string[]) {
      store.commit('Files/CLEAR_CURRENT_FILES_LIST')

      let body = '<?xml version="1.0"?>\n' + '<oc:filter-files '

      let namespace: string
      for (namespace in client.files.davClient.xmlNamespaces) {
        body += ' xmlns:' + client.files.davClient.xmlNamespaces[namespace] + '="' + namespace + '"'
      }
      body += '>\n'

      if (!extensionFilter) {
        return
      }

      body +=
        '<d:prop>\n' +
        '<oc:permissions />\n' +
        '<oc:favorite />\n' +
        '<oc:fileid />\n' +
        '<oc:file-parent />\n' +
        '<oc:name />\n' +
        '<oc:owner-id />\n' +
        '<oc:owner-display-name />\n' +
        '<oc:shareid />\n' +
        '<oc:shareroot />\n' +
        '<oc:share-types />\n' +
        '<oc:privatelink />\n' +
        '<d:getcontentlength />\n' +
        '<oc:size />\n' +
        '<d:getlastmodified />\n' +
        '<d:getetag />\n' +
        '<d:getcontenttype />\n' +
        '<d:resourcetype />\n' +
        '<oc:downloadURL />\n' +
        '<oc:tags />\n' +
        '</d:prop>\n'

      body += '<oc:filter-rules>\n'
      if (projectNames.length) {
        projectNames.forEach((name) => {
          if (name) {
            body += `<oc:projects>${name}</oc:projects>\n`
          }
        })
      }
      if (extensionFilter) {
        body += `<oc:my-office-files>${extensionFilter}</oc:my-office-files>\n`
      }

      body += '</oc:filter-rules>\n' + '</oc:filter-files>'

      const user = yield client.getCurrentUser()
      const fetchUri = client.files.davClient.baseUrl + `/files/${user.id}`

      let resources = yield fetch(fetchUri, {
        method: 'REPORT',
        body,
        headers: {
          Accept: 'application/json, text/plain, */*',
          Authorization: 'Bearer ' + store.getters.getToken,
          'Content-Type': 'application/xml; charset=utf-8'
        }
      })

      const xmlResponse = yield resources.text()

      const xmlNamespacesComponents = {
        d: 'DAV:',
        oc: 'http://owncloud.org/ns'
      }

      const parsePropNode = (propNode) => {
        let content = null
        if (propNode.constructor === Object) {
          if (Object.keys(propNode).length === 0) {
            return ''
          }
          const subNodes = []
          for (const key in propNode) {
            const node = propNode[key]
            if (typeof node !== 'object') {
              subNodes.push(node)
              continue
            }
            if (Array.isArray(node)) {
              for (const item of node) {
                subNodes.push(item)
              }
              continue
            }
            const nsComponent = key.split(':')[0]
            const localComponent = key.split(':')[1]
            const nsValue = xmlNamespacesComponents[nsComponent]
            subNodes.push('{' + nsValue + '}' + localComponent)
          }
          if (subNodes.length) {
            content = subNodes
          }
        } else if (propNode) {
          content = propNode
        } else {
          content = ''
        }
        return content
      }

      const parseMultiStatus = (xmlBody: string) => {
        const doc = xml2js(xmlBody, { compact: true })
        let responseIterator = doc['d:multistatus']['d:response'] || []
        if (responseIterator.constructor !== Array) {
          responseIterator = [responseIterator]
        }
        const result = []

        responseIterator.forEach((responseNode: { [x: string]: any }) => {
          const response = {
            href: null,
            propStat: []
          }
          response.href = responseNode['d:href']
          let propStatIterator = responseNode['d:propstat']

          if (propStatIterator.constructor !== Array) {
            propStatIterator = [propStatIterator]
          }
          propStatIterator.forEach((propStatNode: { [x: string]: any }) => {
            const propStat = {
              status: propStatNode['d:status'],
              properties: {}
            }
            let propIterator = propStatNode['d:prop']
            if (propIterator.constructor !== Array) {
              propIterator = [propIterator]
            }
            propIterator.forEach((propNode: { [x: string]: any }) => {
              for (const key in propNode) {
                const content = parsePropNode(propNode[key])
                const nsComponent = key.split(':')[0]
                const localComponent = key.split(':')[1]
                const nsValue = xmlNamespacesComponents[nsComponent]
                propStat.properties['{' + nsValue + '}' + localComponent] = content
              }
            })
            response.propStat.push(propStat)
          })
          result.push(response)
        })
        return result
      }

      const extractPath = (path: string, leftTrimComponents: number) => {
        let pathSections = path.split('/')
        pathSections = pathSections.filter(function (section) {
          return section !== ''
        })

        const remoteIndex = pathSections.findIndex(
          (section) => decodeURIComponent(section) === 'remote.php'
        )
        if (remoteIndex === -1) {
          return path
        }
        if (['webdav', 'dav'].indexOf(decodeURIComponent(pathSections[remoteIndex + 1])) === -1) {
          return null
        }

        // build the sub-path from the remaining sections
        leftTrimComponents = leftTrimComponents || 0
        let subPath = ''
        let i = remoteIndex + leftTrimComponents + 2
        while (i < pathSections.length) {
          subPath += '/' + decodeURIComponent(pathSections[i])
          i++
        }
        return subPath
      }

      const parseFileInfo = (
        response: { href: any; propStat: string | any[] },
        leftTrimComponents = 0
      ) => {
        const path = extractPath(response.href._text, leftTrimComponents)
        // invalid subpath
        if (path === null) {
          return null
        }
        const name = path

        if (response.propStat.length === 0) {
          return null
        }

        const ok = response.propStat[0].status._text === 'HTTP/1.1 200 OK'
        const processing = response.propStat[0].status._text === 'HTTP/1.1 425 TOO EARLY'

        if (!ok && !processing) {
          return null
        }

        const props = response.propStat[0].properties
        let fileType = 'file'
        const resType = props['{DAV:}resourcetype']
        if (resType) {
          const node = resType[0]
          if (node === '{DAV:}collection') {
            fileType = 'dir'
          }
        }

        const fileInfo = {
          name,
          type: fileType,
          processing,
          fileInfo: {},
          tusSuport: null
        }

        for (const prop in props) {
          fileInfo.fileInfo[prop] = props[prop][0]
        }

        return fileInfo
      }

      const parseBody = (responses: string | any[], leftTrimComponents = 0) => {
        if (!Array.isArray(responses)) {
          responses = [responses]
        }
        const fileInfos = []
        for (let i = 0; i < responses.length; i++) {
          const fileInfo = parseFileInfo(responses[i], leftTrimComponents)
          if (fileInfo !== null) {
            fileInfos.push(fileInfo)
          }
        }
        return fileInfos
      }

      resources = parseBody(parseMultiStatus(xmlResponse))

      resources = resources.map((f: any) => {
        const resource = buildResource(f)
        if (!resource.storageId) {
          resource.storageId = store.getters.user.id
        }
        return resource
      })
      store.commit('Files/LOAD_FILES', {
        currentFolder: null,
        files: resources
      })
      store.dispatch('Files/loadIndicators', {
        client: client,
        currentFolder: '/'
      })
    })
  }
}
