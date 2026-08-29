#!/usr/bin/env node
import process from 'node:process'
import { errorMessage } from '../util/errorMessage'
import { run } from './index'

/** Progress only when the output can overwrite a line in place. */
const io = {
  line: (text: string): void => {
    console.log(text)
  },
  ...(process.stdout.isTTY
    ? {
        progress: (text: string): void => {
          process.stdout.write(`\r  ${text}`)
        },
      }
    : {}),
}

run(process.argv.slice(2), {}, io).then(
  (code) => {
    process.exitCode = code
  },
  (cause: unknown) => {
    console.error(errorMessage(cause))
    process.exitCode = 1
  },
)
