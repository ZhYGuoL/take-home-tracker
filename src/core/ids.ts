/**
 * Makes UUIDv7 ids: a millisecond timestamp first, then a counter, then random bits.
 * Ids made later sort later as text, even inside one millisecond. Timeline entries with the
 * same time then keep the order she saved them in.
 */
export function uuidv7Factory(
  now: () => number = Date.now,
  random: (bytes: Uint8Array<ArrayBuffer>) => void = (b) => crypto.getRandomValues(b),
): () => string {
  let lastMs = -1
  let counter = 0
  return () => {
    let ms = now()
    if (ms <= lastMs) {
      ms = lastMs
      counter++
      if (counter > 0xfff) {
        ms++
        counter = 0
      }
    } else {
      counter = 0
    }
    lastMs = ms
    const rand = new Uint8Array(8)
    random(rand)
    const hex = (n: number, width: number) => n.toString(16).padStart(width, '0')
    const tail = [...rand].map((b) => hex(b, 2)).join('')
    const time = hex(ms, 12)
    const variant = hex(0x8 | ((rand[0] ?? 0) & 0x3), 1)
    return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${hex(counter, 3)}-${variant}${tail.slice(1, 4)}-${tail.slice(4, 16)}`
  }
}
