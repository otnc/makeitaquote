declare module 'displus' {
  function removeMarkdown(input: string, extra?: boolean): string

  const displus: {
    removeMarkdown: typeof removeMarkdown
  }

  export = displus
}
