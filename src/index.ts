import axios from 'axios'
import displus from 'displus'

export interface Format {
  text: string
  avatar: string | null
  username: string
  display_name: string
  color: boolean
  watermark: string
}

interface DiscordAuthorLike {
  username: string
  discriminator?: string
  global_name?: string | null
  displayAvatarURL(): string
}

interface DiscordMemberLike {
  displayName: string
  displayAvatarURL(): string
}

export interface DiscordMessageLike {
  content: string
  author: DiscordAuthorLike
  member?: DiscordMemberLike | null
}

const GENERATE_API_URL = 'https://api.voids.top/fakequote'
const GENERATE_BETA_API_URL = 'https://api.voids.top/fakequotebeta'

/**
 * The MiQ class is designed to create a quote with customizable properties such as text, avatar, username, display name, color, and watermark. It also provides a method to generate a quote image or data from an external API.
 */
export class MiQ {
  private format: Format

  constructor() {
    this.format = {
      text: '',
      avatar: null,
      username: '',
      display_name: '',
      color: false,
      watermark: '',
    }
  }

  /**
   * Sets the quote properties based on a Discord message object.
   */
  setFromMessage(message: DiscordMessageLike, formatText = false): MiQ {
    this.setText(message.content, formatText)
    this.setAvatar(
      message.member ? message.member.displayAvatarURL() : message.author.displayAvatarURL(),
    )
    this.setUsername(
      !message.author.discriminator || message.author.discriminator === '0'
        ? message.author.username
        : `${message.author.username}#${message.author.discriminator}`,
    )
    this.setDisplayname(
      message.member
        ? message.member.displayName
        : (message.author.global_name ?? message.author.username),
    )
    return this
  }

  /**
   * Sets the quote properties based on an object.
   */
  setFromObject(data: Partial<Format>, formatText = false): MiQ {
    if (data.text) this.setText(data.text, formatText)
    if (data.avatar) this.setAvatar(data.avatar)
    if (data.username) this.setUsername(data.username)
    if (data.display_name) this.setDisplayname(data.display_name)
    if (typeof data.color === 'boolean') this.setColor(data.color)
    if (data.watermark) this.setWatermark(data.watermark)
    return this
  }

  /**
   * Sets the text of the quote. Optionally formats the text to remove markdown.
   */
  setText(text: string, formatText = false): MiQ {
    let t = text
    if (typeof text !== 'string') {
      throw new TypeError('Text must be string')
    }
    if (typeof formatText !== 'boolean') {
      throw new TypeError('formatText must be boolean')
    }
    if (formatText) t = displus.removeMarkdown(t)
    this.format.text = t
    return this
  }

  /**
   * Sets the avatar URL of the quote.
   */
  setAvatar(avatar: string | null): MiQ {
    if (avatar !== null && typeof avatar !== 'string') {
      throw new TypeError('Avatar must be string or null')
    }
    this.format.avatar = avatar
    return this
  }

  /**
   * Sets the username of the quote.
   */
  setUsername(username: string): MiQ {
    if (typeof username !== 'string') {
      throw new TypeError('Username must be string')
    }
    this.format.username = username
    return this
  }

  /**
   * Sets the display name of the quote.
   */
  setDisplayname(display_name: string): MiQ {
    if (typeof display_name !== 'string') {
      throw new TypeError('Display name must be string')
    }
    this.format.display_name = display_name
    return this
  }

  /**
   * Sets whether the quote should have a colored background.
   */
  setColor(color = false): MiQ {
    if (typeof color !== 'boolean') {
      throw new TypeError('Color must be boolean')
    }
    this.format.color = color
    return this
  }

  /**
   * Sets the watermark text of the quote.
   */
  setWatermark(watermark: string): MiQ {
    if (typeof watermark !== 'string') {
      throw new TypeError('Watermark must be string')
    }
    this.format.watermark = watermark
    return this
  }

  /**
   * Generates the quote by sending a request to the external API.
   *
   * `/fakequote` only ever responds with JSON containing the hosted image's URL (verified
   * against the live API), so returning the raw image requires a second request to fetch
   * that URL. This differs from generateBeta(), whose endpoint returns the image bytes directly.
   */
  async generate(returnRawImage = false): Promise<string | Buffer> {
    if (!this.format.text) {
      throw new Error('Text is required')
    }
    if (typeof returnRawImage !== 'boolean') {
      throw new TypeError('returnRawImage must be boolean')
    }

    try {
      if (returnRawImage) {
        const response = (await axios.post(GENERATE_API_URL, this.format)).data
        const imageBuffer = await axios.get(response.url, { responseType: 'arraybuffer' })
        return Buffer.from(imageBuffer.data, 'binary')
      }
      const response = await axios.post(GENERATE_API_URL, this.format, { responseType: 'json' })
      return response.data.url
    } catch (error) {
      throw MiQ.wrapApiError(error)
    }
  }

  /**
   * Generates the quote by sending a request to the external API, returning the raw image data directly.
   */
  async generateBeta(): Promise<Buffer> {
    if (!this.format.text) {
      throw new Error('Text is required')
    }

    try {
      const response = (
        await axios.post(GENERATE_BETA_API_URL, this.format, { responseType: 'arraybuffer' })
      ).data
      return Buffer.from(response)
    } catch (error) {
      throw MiQ.wrapApiError(error)
    }
  }

  /**
   * Returns a copy of the current format settings of the quote.
   */
  getFormat(): Format {
    return { ...this.format }
  }

  private static wrapApiError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return new Error(
          `Failed to generate quote: ${error.message}, Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`,
        )
      }
      if (error.request) {
        return new Error(`Failed to generate quote: No response received, ${error.message}`)
      }
      return new Error(`Failed to generate quote: ${error.message}`)
    }
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`Failed to generate quote: ${message}`)
  }
}
