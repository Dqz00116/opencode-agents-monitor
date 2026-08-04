// Generates the "Agents" pixel wordmark in opencode's ornate art style.
// Art rules extracted from opencode's logo-ornate.svg:
//   - 6px cell grid, glyphs 4 cells wide, body 5 cells tall (+1-2 overshoot rows)
//   - two-tone wordmark: first half / second half
//   - accent blocks ('d' cells) aligned to one horizontal band (rows 2-3),
//     filling the lower half of each letter's interior -> one continuous shadow line
import { writeFileSync } from "fs"

const CELL = 6
const GAP = 6
const TOP = 6

const GLYPHS = {
  a: ["####", "#..#", "####", "#dd#", "#dd#"],
  g: ["####", "#..#", "#dd#", "#dd#", "####", "...#", "####"],
  e: ["####", "#..#", "####", "#ddd", "####"],
  n: ["####", "#..#", "#dd#", "#dd#", "#dd#"],
  t: [".#..", "####", ".#d.", ".#d.", ".###"],
  s: ["####", "#...", "####", "ddd#", "####"],
}

const WORD = "agents"

function render(main, accent) {
  const parts = []
  let x = 0
  for (let i = 0; i < WORD.length; i++) {
    const rows = GLYPHS[WORD[i]]
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const cell = rows[r][c]
        if (cell === ".") continue
        parts.push(
          `<rect x="${x + c * CELL}" y="${TOP + r * CELL}" width="${CELL}" height="${CELL}" fill="${cell === "d" ? accent : main}"/>`,
        )
      }
    }
    x += 4 * CELL + GAP
  }
  const width = x - GAP
  const height = TOP + Math.max(...Object.values(GLYPHS).map((g) => g.length)) * CELL
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${parts.join("\n")}\n</svg>\n`
}

writeFileSync(new URL("../assets/logo-dark.svg", import.meta.url), render("#F1ECEC", "#4B4646"))
writeFileSync(new URL("../assets/logo-light.svg", import.meta.url), render("#211E1E", "#CFCECD"))
console.log("written")
