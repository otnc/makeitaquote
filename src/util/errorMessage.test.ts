import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('reads the message off an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('stringifies anything else that was thrown', () => {
    expect(errorMessage('boom')).toBe('boom')
    expect(errorMessage(404)).toBe('404')
    expect(errorMessage(null)).toBe('null')
  })
})
