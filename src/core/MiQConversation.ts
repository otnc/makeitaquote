import type { Readable } from 'node:stream'
import { encode, encodeDataURL, encodeStream } from '../output/encode'
import type { Canvas } from '../render/canvasFactory'
import { renderConversation } from '../render/conversationPipeline'
import { fromNote } from './note'
import { fromMessage } from './source'
import type {
  ConversationMessage,
  ConversationOptions,
  ConversationThemeName,
  EncodeOptions,
  MessageLike,
  MessageSourceOptions,
  NoteSourceOptions,
  OutputFormat,
} from './types'

/**
 * Builds a Discord-style message log as one image: several messages stacked,
 * each with its own avatar, name and wrapped text.
 *
 * A separate class from `MiQ` rather than an array mode on it, because a
 * conversation has none of a quote's per-field theming — two built-in looks
 * (`'dark'` / `'light'`), not the full `Theme` system.
 *
 * ```ts
 * const png = await new MiQConversation()
 *   .addMessage({ username: 'otoneko.', text: '吾輩は猫である。' })
 *   .addMessage({ username: 'otoneko.', text: '名前はまだ無い。' })
 *   .toBuffer('png')
 * ```
 *
 * Nothing is drawn, fetched or downloaded until an output method is called.
 */
export class MiQConversation {
  #messages: ConversationMessage[] = []
  #options: ConversationOptions

  constructor(options: ConversationOptions = {}) {
    this.#options = { ...options }
  }

  /** Appends one message. */
  addMessage(message: ConversationMessage): this {
    this.#messages.push({ ...message })
    return this
  }

  /** Replaces every message with this list. */
  setMessages(messages: readonly ConversationMessage[]): this {
    this.#messages = messages.map((message) => ({ ...message }))
    return this
  }

  /**
   * Replaces every message with these, read off real Discord messages the
   * same way `MiQ#setFromMessage()` reads one — content, name and avatar,
   * with the same `avatar`/`name`/`stripMarkdown`/`resolveMentions` options.
   */
  setFromMessages(messages: readonly unknown[], options?: MessageSourceOptions): this {
    this.#messages = messages.map((message) => {
      const quote = fromMessage(message as MessageLike, options)
      return {
        text: quote.text,
        username: quote.username,
        displayName: quote.displayName,
        avatar: quote.avatar,
      }
    })
    return this
  }

  /** The same, for Misskey notes. See `MiQ#setFromNote()`. */
  setFromNotes(notes: readonly unknown[], options?: NoteSourceOptions): this {
    this.#messages = notes.map((note) => {
      const quote = fromNote(note, options)
      return {
        text: quote.text,
        username: quote.username,
        displayName: quote.displayName,
        avatar: quote.avatar,
      }
    })
    return this
  }

  setTheme(theme: ConversationThemeName): this {
    this.#options = { ...this.#options, theme }
    return this
  }

  getMessages(): readonly ConversationMessage[] {
    return this.#messages.map((message) => ({ ...message }))
  }

  clone(): MiQConversation {
    const copy = new MiQConversation(this.#options)
    copy.#messages = this.#messages.map((message) => ({ ...message }))
    return copy
  }

  /** The rendered canvas, for callers who want to draw on top of it. */
  async render(): Promise<Canvas> {
    return renderConversation(this.#messages, this.#options)
  }

  async toBuffer(format: OutputFormat = 'png', options?: EncodeOptions): Promise<Buffer> {
    return encode(await this.render(), format, options)
  }

  async toStream(format: OutputFormat = 'png', options?: EncodeOptions): Promise<Readable> {
    return encodeStream(await this.render(), format, options)
  }

  async toDataURL(format: OutputFormat = 'png', options?: EncodeOptions): Promise<string> {
    return encodeDataURL(await this.render(), format, options)
  }
}
