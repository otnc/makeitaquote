import { stripMfm } from '../text/mfm'
import { ValidationError } from './errors'
import { emptyQuote } from './quote'
import type { NoteLike, NoteSourceOptions, QuoteData } from './types'

function isNoteLike(value: unknown): value is NoteLike {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<NoteLike>
  if (candidate.user === null || typeof candidate.user !== 'object') return false
  return typeof candidate.user.username === 'string'
}

/**
 * The handle, minus its leading `@`.
 *
 * `username.prefix` on the theme supplies that — the same contract
 * `fromMessage()` works to — so including it here would draw `@@otoneko`.
 * A remote author keeps the `@host` half, which is part of the handle
 * rather than decoration.
 */
function handle(user: NoteLike['user']): string {
  return user.host ? `${user.username}@${user.host}` : user.username
}

/**
 * Derives a quote from a Misskey note.
 *
 * The Misskey counterpart to `fromMessage()`, and shaped by the same rule:
 * quote what a reader saw. That means the display name over the handle, the
 * author's own avatar, and — by default — the note with its MFM scaffolding
 * taken off.
 *
 * Unlike Discord there is nothing here to resolve by id. A Misskey mention
 * is written `@user@host` in the note text already, so it is readable as it
 * stands and is left exactly alone.
 */
export function fromNote(note: unknown, options: NoteSourceOptions = {}): QuoteData {
  if (!isNoteLike(note)) {
    throw new ValidationError('setFromNote expects a note with `user.username`', { field: 'note' })
  }

  const source = options.preferCw ? (note.cw ?? note.text ?? '') : (note.text ?? note.cw ?? '')

  const quote = emptyQuote()
  quote.text = options.stripMfm === false ? source : stripMfm(source)
  quote.username = handle(note.user)
  quote.displayName = note.user.name || note.user.username
  quote.avatar = note.user.avatarUrl ?? null

  return quote
}
