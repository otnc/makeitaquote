/**
 * The two Voids endpoints are not "stable" and "beta" — they return different
 * things, and only one of them can give you a URL.
 *
 * - `/fakequote` renders the image, uploads it, and answers with `{ url }`.
 *   Getting the bytes therefore costs a second request, and the image lives on
 *   someone else's server afterwards.
 * - `/fakequotebeta` answers with the image itself. One round trip, nothing
 *   stored.
 *
 * So the method you call decides the endpoint, not the other way round.
 */
export const endpoints = {
  hosted: {
    path: '/fakequote',
    returns: 'url',
    roundTripsForBuffer: 2,
  },
  direct: {
    path: '/fakequotebeta',
    returns: 'binary',
    roundTripsForBuffer: 1,
  },
} as const

export type EndpointPath = (typeof endpoints)[keyof typeof endpoints]['path']

export const DEFAULT_BASE_URL = 'https://api.voids.top'
