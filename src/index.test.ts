import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MiQ } from './index'

const { postMock, getMock, isAxiosErrorMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
  isAxiosErrorMock: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    post: postMock,
    get: getMock,
    isAxiosError: isAxiosErrorMock,
  },
}))

const GENERATE_API_URL = 'https://api.voids.top/fakequote'
const GENERATE_BETA_API_URL = 'https://api.voids.top/fakequotebeta'

function axiosError(overrides: Partial<{ response: unknown; request: unknown; message: string }>) {
  return { isAxiosError: true, message: 'request failed', ...overrides }
}

beforeEach(() => {
  postMock.mockReset()
  getMock.mockReset()
  isAxiosErrorMock.mockReset()
  isAxiosErrorMock.mockImplementation((error: unknown) =>
    Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  )
})

describe('constructor', () => {
  it('starts with empty defaults', () => {
    expect(new MiQ().getFormat()).toEqual({
      text: '',
      avatar: null,
      username: '',
      display_name: '',
      color: false,
      watermark: '',
    })
  })
})

describe('setText', () => {
  it('throws TypeError when text is not a string', () => {
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setText(1 as any)).toThrow(TypeError)
  })

  it('throws TypeError when formatText is not a boolean', () => {
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setText('hi', 'yes' as any)).toThrow(TypeError)
  })

  it('strips markdown when formatText is true', () => {
    const miq = new MiQ().setText('**bold**', true)
    expect(miq.getFormat().text).toBe('bold')
  })

  it('keeps the raw text when formatText is false', () => {
    const miq = new MiQ().setText('**bold**')
    expect(miq.getFormat().text).toBe('**bold**')
  })

  it('is chainable', () => {
    expect(new MiQ().setText('hi')).toBeInstanceOf(MiQ)
  })
})

describe('setAvatar', () => {
  it('accepts a string', () => {
    expect(new MiQ().setAvatar('https://example.com/a.png').getFormat().avatar).toBe(
      'https://example.com/a.png',
    )
  })

  it('accepts null', () => {
    expect(new MiQ().setAvatar(null).getFormat().avatar).toBeNull()
  })

  it('throws TypeError for other types', () => {
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setAvatar(1 as any)).toThrow(TypeError)
  })
})

describe('setUsername / setDisplayname / setWatermark', () => {
  it('throws TypeError when not given a string', () => {
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setUsername(1 as any)).toThrow(TypeError)
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setDisplayname(1 as any)).toThrow(TypeError)
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setWatermark(1 as any)).toThrow(TypeError)
  })

  it('sets the value when given a string', () => {
    const format = new MiQ()
      .setUsername('user')
      .setDisplayname('Display')
      .setWatermark('mark')
      .getFormat()
    expect(format.username).toBe('user')
    expect(format.display_name).toBe('Display')
    expect(format.watermark).toBe('mark')
  })
})

describe('setColor', () => {
  it('defaults to false', () => {
    expect(new MiQ().setColor().getFormat().color).toBe(false)
  })

  it('throws TypeError when not given a boolean', () => {
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    expect(() => new MiQ().setColor('yes' as any)).toThrow(TypeError)
  })
})

describe('setFromMessage', () => {
  it('prefers the member avatar/display name when a member is present', () => {
    const message = {
      content: 'hello',
      author: {
        username: 'author',
        discriminator: '0',
        global_name: 'Author Global',
        displayAvatarURL: () => 'https://example.com/author.png',
      },
      member: {
        displayName: 'Member Name',
        displayAvatarURL: () => 'https://example.com/member.png',
      },
    }

    const format = new MiQ().setFromMessage(message).getFormat()
    expect(format.text).toBe('hello')
    expect(format.avatar).toBe('https://example.com/member.png')
    expect(format.display_name).toBe('Member Name')
    expect(format.username).toBe('author')
  })

  it('falls back to the author when there is no member', () => {
    const message = {
      content: 'hi',
      author: {
        username: 'author',
        discriminator: undefined,
        global_name: 'Author Global',
        displayAvatarURL: () => 'https://example.com/author.png',
      },
    }

    const format = new MiQ().setFromMessage(message).getFormat()
    expect(format.avatar).toBe('https://example.com/author.png')
    expect(format.display_name).toBe('Author Global')
    expect(format.username).toBe('author')
  })

  it('appends a legacy, non-zero discriminator', () => {
    const message = {
      content: 'hi',
      author: {
        username: 'author',
        discriminator: '1234',
        displayAvatarURL: () => 'https://example.com/author.png',
      },
    }

    const format = new MiQ().setFromMessage(message).getFormat()
    expect(format.username).toBe('author#1234')
  })

  it('formats text when formatText is true', () => {
    const message = {
      content: '**hi**',
      author: {
        username: 'author',
        displayAvatarURL: () => 'https://example.com/author.png',
      },
    }

    expect(new MiQ().setFromMessage(message, true).getFormat().text).toBe('hi')
  })
})

describe('setFromObject', () => {
  it('only applies fields that are present', () => {
    const miq = new MiQ().setUsername('keep-me')
    miq.setFromObject({ text: 'hi', color: true })
    const format = miq.getFormat()
    expect(format.text).toBe('hi')
    expect(format.color).toBe(true)
    expect(format.username).toBe('keep-me')
  })

  it('passes formatText through to setText', () => {
    const format = new MiQ().setFromObject({ text: '**hi**' }, true).getFormat()
    expect(format.text).toBe('hi')
  })
})

describe('generate', () => {
  it('throws when text is not set', async () => {
    await expect(new MiQ().generate()).rejects.toThrow('Text is required')
  })

  it('throws TypeError when returnRawImage is not a boolean', async () => {
    const miq = new MiQ().setText('hi')
    // biome-ignore lint: intentionally passing an invalid type to check runtime validation
    await expect(miq.generate('yes' as any)).rejects.toThrow(TypeError)
  })

  it('returns the hosted URL by default', async () => {
    postMock.mockResolvedValueOnce({ data: { url: 'https://cdn.voids.top/quotes/a.png' } })

    const url = await new MiQ().setText('hi').generate()

    expect(url).toBe('https://cdn.voids.top/quotes/a.png')
    expect(postMock).toHaveBeenCalledWith(
      GENERATE_API_URL,
      expect.objectContaining({ text: 'hi' }),
      { responseType: 'json' },
    )
  })

  it('fetches the hosted URL as raw bytes when returnRawImage is true', async () => {
    postMock.mockResolvedValueOnce({ data: { url: 'https://cdn.voids.top/quotes/a.png' } })
    getMock.mockResolvedValueOnce({ data: Buffer.from('image-bytes') })

    const result = await new MiQ().setText('hi').generate(true)

    expect(postMock).toHaveBeenCalledWith(GENERATE_API_URL, expect.objectContaining({ text: 'hi' }))
    expect(getMock).toHaveBeenCalledWith('https://cdn.voids.top/quotes/a.png', {
      responseType: 'arraybuffer',
    })
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('wraps an error that has a response', async () => {
    postMock.mockRejectedValueOnce(
      axiosError({ response: { status: 400, data: { error: 'bad request' } } }),
    )

    await expect(new MiQ().setText('hi').generate()).rejects.toThrow(/Status: 400/)
  })

  it('wraps an error that has a request but no response', async () => {
    postMock.mockRejectedValueOnce(axiosError({ request: {} }))

    await expect(new MiQ().setText('hi').generate()).rejects.toThrow('No response received')
  })

  it('wraps a plain axios error with neither request nor response', async () => {
    postMock.mockRejectedValueOnce(axiosError({}))

    await expect(new MiQ().setText('hi').generate()).rejects.toThrow(
      'Failed to generate quote: request failed',
    )
  })

  it('wraps a non-axios error', async () => {
    isAxiosErrorMock.mockReturnValue(false)
    postMock.mockRejectedValueOnce(new Error('boom'))

    await expect(new MiQ().setText('hi').generate()).rejects.toThrow(
      'Failed to generate quote: boom',
    )
  })
})

describe('generateBeta', () => {
  it('throws when text is not set', async () => {
    await expect(new MiQ().generateBeta()).rejects.toThrow('Text is required')
  })

  it('returns the raw image bytes in a single request', async () => {
    postMock.mockResolvedValueOnce({ data: Buffer.from('image-bytes') })

    const result = await new MiQ().setText('hi').generateBeta()

    expect(postMock).toHaveBeenCalledWith(
      GENERATE_BETA_API_URL,
      expect.objectContaining({ text: 'hi' }),
      { responseType: 'arraybuffer' },
    )
    expect(getMock).not.toHaveBeenCalled()
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('wraps errors the same way as generate', async () => {
    postMock.mockRejectedValueOnce(
      axiosError({ response: { status: 500, data: { error: 'server error' } } }),
    )

    await expect(new MiQ().setText('hi').generateBeta()).rejects.toThrow(/Status: 500/)
  })
})

describe('getFormat', () => {
  it('returns a copy that cannot mutate internal state', () => {
    const miq = new MiQ().setText('hi')
    const format = miq.getFormat()
    format.text = 'tampered'
    expect(miq.getFormat().text).toBe('hi')
  })
})
