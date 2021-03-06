export function isValidHttpUrl(string) {
  let url

  try {
    url = new URL(string)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

export function parseHostName(string) {
  try {
    const { hostname } = new URL(string)
    return hostname
  } catch (error) {
    return string
  }
}

export function textEllipsis(str, maxLength, { side = 'end', ellipsis = '...' } = {}) {
  if (str.length > maxLength) {
    switch (side) {
      case 'start':
        return ellipsis + str.slice(-(maxLength - ellipsis.length))
      case 'end':
      default:
        return str.slice(0, maxLength - ellipsis.length) + ellipsis
    }
  }
  return str
}
