import { AttachmentBuilder, Client, Events, GatewayIntentBits } from 'discord.js'
import { fonts, MiQ } from 'makeitaquote'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once(Events.ClientReady, async () => {
  // Optional, but worth doing at startup: gets the font download out of the
  // way so the first quote isn't slower than the rest.
  await fonts.ensureDefaults()
  console.log('ready')
})

client.on(Events.MessageCreate, async (message) => {
  if (message.content !== '!miq' || !message.reference?.messageId) return

  const replied = await message.channel.messages.fetch(message.reference.messageId)

  // setFromMessage reads the content, the guild nickname and the member avatar,
  // and understands both Pomelo and legacy usernames.
  const png = await new MiQ().setFromMessage(replied).toBuffer('png')

  await message.reply({
    files: [new AttachmentBuilder(png, { name: 'quote.png' })],
  })
})

client.login(process.env.DISCORD_TOKEN)
