import { MiQ } from 'makeitaquote'
import { VoidsMiQ } from 'makeitaquote/api'

const quote = () =>
  new VoidsMiQ().setText('Hello World!').setUsername('otoneko.').setDisplayName('音猫｡')

// The two endpoints do different things, so the method you call picks one:
//
//   toURL()    -> POST /fakequote      returns a URL; the image is uploaded
//                                      to the API's storage and hosted there
//   toBuffer() -> POST /fakequotebeta  returns the image itself, in one round
//                                      trip, and nothing is stored
const url = await quote().toURL()
const png = await quote().toBuffer()

// If you specifically want the bytes of the *hosted* image, this goes through
// /fakequote and then downloads it — two round trips.
const hosted = await quote().toBuffer({ hosted: true })

console.log(url, png.byteLength, hosted.byteLength)

// A quote built for one can be handed to the other, so the API can be a
// primary with local rendering as the fallback.
const data = new MiQ().setText('Hello World!').setUsername('otoneko.').getData()

let image: Buffer
try {
  image = await new VoidsMiQ().setFromObject(data).toBuffer()
} catch {
  image = await new MiQ().setFromObject(data).toBuffer('png')
}

console.log(image.byteLength)
