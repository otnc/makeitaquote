import { ValidationError } from './errors'
import { normalizeAvatar, normalizeDisplayName, normalizeText, normalizeUsername } from './quote'
import type { AvatarSource, ConversationMessage } from './types'

/**
 * A message after `normalizeConversationMessage()` — `avatar` is always
 * present (never `undefined`), same relationship `QuoteData` has to
 * `QuoteInput`.
 */
export interface NormalizedConversationMessage {
  text: string
  username: string
  displayName?: string
  avatar: AvatarSource | null
}

/** Validates and normalizes one message, the same way `applyInput` does for a quote. */
export function normalizeConversationMessage(
  input: ConversationMessage,
): NormalizedConversationMessage {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('a conversation message must be an object', { field: 'message' })
  }

  return {
    text: normalizeText(input.text),
    username: normalizeUsername(input.username),
    ...(input.displayName !== undefined
      ? { displayName: normalizeDisplayName(input.displayName) }
      : {}),
    avatar: normalizeAvatar(input.avatar),
  }
}

/** A conversation needs at least one message, and each needs real content. */
export function assertMessageRenderable(
  message: NormalizedConversationMessage,
  index: number,
): void {
  if (message.text.trim().length === 0) {
    throw new ValidationError(`messages[${index}].text is required`, {
      field: `messages[${index}].text`,
    })
  }
  if (message.username.trim().length === 0) {
    throw new ValidationError(`messages[${index}].username is required`, {
      field: `messages[${index}].username`,
    })
  }
}

export function assertHasMessages(messages: readonly NormalizedConversationMessage[]): void {
  if (messages.length === 0) {
    throw new ValidationError('a conversation needs at least one message', { field: 'messages' })
  }
}

/** The name drawn above a message: the display name, falling back to the username. */
export function effectiveConversationName(message: NormalizedConversationMessage): string {
  return message.displayName || message.username
}
