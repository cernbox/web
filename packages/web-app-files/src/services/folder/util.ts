export const fetchResources = async (client, path, properties, userId) => {
  const path2 = path.replace('personal', userId)
  try {
    return await client.files.list(path2, 1, properties)
  } catch (error) {
    console.error(error)
  }
}
