const { MiQ } = require('../dist/index.cjs')

async function main() {
  try {
    // URL
    const url = await new MiQ()
      .setText('Hello World!')
      .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
      .setUsername('otoneko.')
      .setDisplayname('音猫｡')
      .setColor(false)
      .setWatermark('Make it a Quote#6666')
      .generate()

    console.log('Image URL:', url)

    // URL (Color)
    const urlColor = await new MiQ()
      .setText('Hello World!')
      .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
      .setUsername('otoneko.')
      .setDisplayname('音猫｡')
      .setColor(true)
      .setWatermark('Make it a Quote#6666')
      .generate()

    console.log('Image URL Color:', urlColor)

    // Raw
    const rawData = await new MiQ()
      .setText('Hello World!')
      .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
      .setUsername('otoneko.')
      .setDisplayname('音猫｡')
      .setColor(false)
      .setWatermark('Make it a Quote#6666')
      .generate(true)

    console.log('Raw Data:', rawData)

    // Raw (Color)
    const rawDataColor = await new MiQ()
      .setText('Hello World!')
      .setAvatar('https://cdn.discordapp.com/embed/avatars/0.png')
      .setUsername('otoneko.')
      .setDisplayname('音猫｡')
      .setColor(false)
      .setWatermark('Make it a Quote#6666')
      .generate(true)

    console.log('Raw Data Color:', rawDataColor)
  } catch (error) {
    console.error(error)
  }
}

main()
