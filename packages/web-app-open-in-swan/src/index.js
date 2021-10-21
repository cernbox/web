import logo from './logo.js'

const appInfo = {
  name: 'SWAN',
  id: 'open-in-swan',
  iconImg: logo,
  extensions: [
    {
      extension: 'ipynb',
      handler: (info) => {
        window.open("https://cern.ch/swanserver/cgi-bin/go?projurl=file:/" + info.filePath, "_blank");
      },
      showInRightClickMenu: true,
      canBeDefault: false,
      routes: [
        'files-personal',
        'files-favorites',
        'files-shared-with-others',
        'files-shared-with-me'
      ]
    }
  ]
}

export default {
  appInfo
}
