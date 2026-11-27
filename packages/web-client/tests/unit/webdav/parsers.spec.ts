import { parseRestoreCollisions } from '../../../src/webdav/client/parsers'

describe('parseRestoreCollisions', () => {
  it('reads the collisions of a restore', () => {
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<d:error xmlns:d="DAV" xmlns:s="http://sabredav.org/ns">' +
      '<s:exception>Sabre\\DAV\\Exception\\PreconditionFailed</s:exception>' +
      '<s:message>An item is already at the original path</s:message>' +
      '<oc:collisions xmlns:oc="http://owncloud.org/ns">' +
      '<oc:collision><oc:key>20261123/docs/report.txt</oc:key><oc:path>docs/report.txt</oc:path></oc:collision>' +
      '<oc:collision><oc:key>20261123/2024</oc:key><oc:path>2024</oc:path></oc:collision>' +
      '</oc:collisions>' +
      '<s:header>Overwrite</s:header></d:error>'

    expect(parseRestoreCollisions(body)).toEqual([
      { key: '20261123/docs/report.txt', path: 'docs/report.txt' },
      { key: '20261123/2024', path: '2024' }
    ])
  })

  it.each([
    '<d:error xmlns:d="DAV"><oc:collisions xmlns:oc="http://owncloud.org/ns"></oc:collisions></d:error>',
    '<d:error xmlns:d="DAV"><s:message>The destination node already exists</s:message></d:error>',
    ''
  ])('returns no collisions without a list', (body) => {
    expect(parseRestoreCollisions(body)).toEqual([])
  })
})
