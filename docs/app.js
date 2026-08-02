// Renders the gallery from the manifests that `npm run visual` writes.
//
// Deliberately plain: no build step, no dependencies, no framework. Split
// across one file per group (visual/<group>/manifest.json) plus a small
// index (visual/manifest.json) listing which groups exist, so the renderer
// can regenerate one group without touching any other group's file.

const INDEX = 'visual/manifest.json'
const groupManifestUrl = (name) => `visual/${name}/manifest.json`

const gallery = document.querySelector('#gallery')
const groupNav = document.querySelector('#group-nav')
const meta = document.querySelector('#meta')

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function formatBytes(bytes) {
  if (!bytes) return null
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`
}

function statsFor(item) {
  return [
    item.format,
    item.width && item.height ? `${item.width}×${item.height}` : null,
    formatBytes(item.bytes),
  ]
    .filter(Boolean)
    .join(' · ')
}

function cardFor(item) {
  const card = el('figure', item.ok ? 'card' : 'card bad')

  if (item.error) {
    card.append(el('div', 'missing', 'did not render'))
  } else {
    const img = el('img')
    img.src = `visual/${item.file}`
    img.alt = item.name
    img.loading = 'lazy'
    img.decoding = 'async'
    card.append(img)
  }

  const caption = el('figcaption')
  caption.append(el('div', 'name', item.name))
  if (item.note) caption.append(el('div', 'note', item.note))
  caption.append(el('div', 'stats', statsFor(item)))
  if (item.error) caption.append(el('div', 'error', item.error))

  card.append(caption)
  return card
}

function sectionFor(group) {
  const section = el('section', 'group')
  section.id = group.name

  const heading = el('h2')
  heading.append(document.createTextNode(group.title))
  heading.append(el('span', 'count', ` (${group.cases.length})`))
  section.append(heading)

  const grid = el('div', 'grid')
  for (const item of group.cases) grid.append(cardFor(item))
  section.append(grid)

  return section
}

async function fetchJSON(url) {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

async function main() {
  let index
  let groups
  try {
    index = await fetchJSON(INDEX)
    groups = await Promise.all(index.groups.map((group) => fetchJSON(groupManifestUrl(group.name))))
  } catch (error) {
    gallery.replaceChildren(
      el(
        'p',
        'loading',
        `Could not load the gallery (${error.message}). ` +
          'Run `npm run build && npm run visual` to generate it.',
      ),
    )
    meta.textContent = ''
    return
  }

  const total = groups.reduce((sum, group) => sum + group.cases.length, 0)
  const failed = groups.reduce(
    (sum, group) => sum + group.cases.filter((item) => !item.ok).length,
    0,
  )
  meta.textContent = `v${index.version} · ${total} examples` + (failed > 0 ? ` · ${failed} failed` : '')

  groupNav.replaceChildren(
    ...groups.map((group) => {
      const link = el('a', null, group.title)
      link.href = `#${group.name}`
      return link
    }),
  )

  gallery.replaceChildren(...groups.map(sectionFor))
}

main()
