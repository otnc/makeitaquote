import { MiQ } from '../dist/index.mjs'

async function main() {
  try {
    const url = await new MiQ()
      .setText('Hello World!')
      .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
      .setUsername('otoneko.')
      .setDisplayname('音猫｡')
      .setColor(false)
      .setWatermark('Make it a Quote#6666')
      .generate()

    console.log('Image URL:', url)

    const rawData = await new MiQ()
      .setText('Hello World!')
      .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
      .setUsername('otoneko.')
      .setDisplayname('音猫｡')
      .setColor(false)
      .setWatermark('Make it a Quote#6666')
      .generateBeta()

    console.log('Raw Data (beta):', rawData)
  } catch (error) {
    console.error(error)
  }
}

main()
