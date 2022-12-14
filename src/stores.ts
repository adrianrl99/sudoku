import yaml from 'js-yaml'
import { derived, get, writable } from 'svelte/store'

import { Level, Page, Theme } from './enums'
import { isValidCell, sudokuToBoard } from './generate'
import { storage } from './storage'
import type { Board, Games, Move, Posn, Sudoku } from './types'

export const theme = (() => {
  const key = 'color-scheme'
  const { set: _set, subscribe } = writable(Theme.System)

  subscribe(async run => {
    await storage.set(key, run)
    await storage.save()
  })

  return {
    subscribe,
    set(value: Theme) {
      if (value === Theme.System)
        document.documentElement.removeAttribute('color-scheme')
      else document.documentElement.setAttribute('color-scheme', value)
      _set(value)
    },
    async init() {
      const data = await storage.get<Theme>(key)
      if (data) theme.set(data)
    },
  }
})()

export const penActive = writable(false)
export const gamePaused = writable(false)

export const selected = (() => {
  const key = 'selected'
  const { set, subscribe, update } = writable<Posn>()

  subscribe(async run => {
    if (run) {
      await storage.set(key, run)
      await storage.save()
    }
  })

  return {
    subscribe,
    set,
    move(move: Move) {
      update(n =>
        !n
          ? { row: 0, col: 0 }
          : move === 'left'
          ? { ...n, col: n.col > 0 ? n.col - 1 : 0 }
          : move === 'right'
          ? { ...n, col: n.col < 8 ? n.col + 1 : 8 }
          : move === 'up'
          ? { ...n, row: n.row > 0 ? n.row - 1 : 0 }
          : move === 'down'
          ? { ...n, row: n.row < 8 ? n.row + 1 : 0 }
          : n,
      )
    },
    async init() {
      const data = await storage.get<Posn>(key)
      if (data) set(data)
    },
  }
})()

const createSudoku = () => {
  const sudoku: Sudoku = {
    uuid: crypto.randomUUID(),
    timer: 0,
    date: new Date().getTime(),
    data: [],
  }

  for (let row = 0; row <= 8; row++) {
    sudoku.data[row] = []
    for (let col = 0; col <= 8; col++) {
      sudoku.data[row][col] = Array(9)
        .fill(false)
        .reduce((acc, curr, i) => ({ ...acc, [i + 1]: curr }), {
          locked: false,
          default: false,
          invalid: Array(9)
            .fill(false)
            .reduce((acc, curr, i) => ({ ...acc, [i + 1]: curr }), {}),
        })
    }
  }

  return sudoku
}

export const sudoku = (() => {
  const key = 'current-game'
  const { set, subscribe, update } = writable<Sudoku>(createSudoku())

  subscribe(async run => {
    await storage.set(key, run)
    await storage.save()

    if (get(page) === Page.Game && get(hasGame)) games.setGame(run)
  })

  return {
    subscribe,
    set,
    setBoard(board: Board, level: Level) {
      update(n => {
        n = createSudoku()
        n.level = level

        board.forEach((rows, row) => {
          rows.forEach((v, col) => {
            const curr = n.data[row][col]

            if (v) {
              curr.default = true
              curr[v] = true
            }
          })
        })

        return n
      })
    },
    setLock(lock: boolean) {
      const $selected = get(selected)
      update(n => {
        const curr = n.data[$selected.row][$selected.col]
        const nums = Object.entries(curr).filter(
          ([k, v]) => k.match(/^[1-9]$/) && v,
        )
        const invalid = nums.map(([k]) => curr.invalid[k]).some(Boolean)

        if (!curr.default && nums.length === 1 && !invalid) {
          curr.locked = lock
        }
        return n
      })
    },
    setValue(value: number) {
      if (value >= 1 && value <= 9) {
        const $selected = get(selected)
        const $penActive = get(penActive)

        if ($selected)
          update(n => {
            const curr = n.data[$selected.row][$selected.col]
            const nums = Object.entries(curr).filter(
              ([k, v]) => k.match(/^[1-9]$/) && v,
            )
            if (!curr.locked && !curr.default) {
              const prev = curr[value]
              if (!$penActive) {
                Array(9)
                  .fill(false)
                  .forEach((_, i) => {
                    curr[i + 1] = false
                  })
              }
              curr.invalid[value] = !isValidCell(
                sudokuToBoard(n),
                value,
                $selected,
              )
              curr[value] = !$penActive && nums.length > 1 ? value : !prev
            }
            return n
          })
      }
    },
    incrementTimer() {
      if (!get(gamePaused)) {
        update(n => {
          n.timer++
          return n
        })
      }
    },
    async remove() {
      await storage.delete(key)
      await storage.save()
    },
    async init() {
      const data = await storage.get<Sudoku>(key)
      if (data) set(data)
    },
  }
})()

export const page = (() => {
  const key = 'page'
  const { set, subscribe, update } = writable<Page>(Page.Menu)

  let interval: NodeJS.Timeout

  subscribe(async run => {
    gamePaused.set(true)
    clearInterval(interval)
    if (run === Page.Game) {
      await storage.set(key, run)
      await storage.save()
      gamePaused.set(false)
      interval = setInterval(sudoku.incrementTimer, 1000)
    } else {
      await storage.delete(key)
      await storage.save()
    }
  })

  return {
    set,
    update,
    subscribe,
    async init() {
      const data = await storage.get<Page>(key)
      if (data) set(data)
    },
  }
})()

export const hasGame = (() => {
  const key = 'has-game'
  const { set, subscribe, update } = writable(false)

  subscribe(async run => {
    await storage.set(key, run)
    await storage.save()
  })

  return {
    set,
    subscribe,
    update,
    async init() {
      const data = await storage.get<boolean>(key)
      if (data) set(data)
    },
  }
})()

export const games = (() => {
  const key = 'games'
  const { set, subscribe, update } = writable<Games>({})

  subscribe(async run => {
    await storage.set(key, run)
    await storage.save()
  })

  return {
    set,
    subscribe,
    setGame(game: Sudoku) {
      update(n => {
        n[game.uuid] = game
        return n
      })
    },
    deleteGame(game: Sudoku) {
      update(n => {
        delete n[game.uuid]
        return n
      })
    },
    async init() {
      const data = await storage.get<Games>(key)
      if (data) set(data)
    },
  }
})()

export const gamesSize = derived(games, $games => Object.keys($games).length)

export const lang = (() => {
  const key = 'language'
  const { set, subscribe } = writable(navigator.language.split('-')[0])

  subscribe(async run => {
    await storage.set(key, run)
    await storage.save()
  })

  return {
    subscribe,
    set,
    async init() {
      const data = await storage.get<string>(key)
      if (data) set(data)
    },
  }
})()

export const messages = (() => {
  const { subscribe, update } = writable<
    Record<string, Record<string, string>>
  >({})

  return {
    subscribe,
    async init() {
      const es = await fetch('/locales/es.yaml')
        .then(res => res.text())
        .then(res => yaml.load(res))
      const en = Object.fromEntries(Object.entries(es).map(([k]) => [k, k]))

      update(n => {
        n.es = es as Record<string, string>
        n.en = en as Record<string, string>
        return n
      })
    },
  }
})()

export const message = (() => {
  const { set, subscribe } = writable<Record<string, string>>({})

  lang.subscribe(run => {
    const $ = get(messages)[run]
    if ($) set($)
  })

  return {
    subscribe,
    async init() {
      set(get(messages)[get(lang)])
    },
  }
})()

export const initStores = async () => {
  try {
    await storage.load()
  } catch (_) {
    //
  }
  await messages.init()
  await lang.init()
  await message.init()
  await theme.init()
  await page.init()
  await sudoku.init()
  await hasGame.init()
  await selected.init()
  await games.init()
}
