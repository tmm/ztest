export function fromString(value: string) {
  return value.split(",").map((url) => new URL(url.trim()))
}

export function origins(urls: URL[]) {
  return urls.map((url) => url.origin)
}
