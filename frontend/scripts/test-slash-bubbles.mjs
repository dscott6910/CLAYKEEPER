import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import ts from "typescript"

const detector = {}
const source = readFileSync(new URL("../src/lib/scorecards/gridScorecardDetector.ts", import.meta.url), "utf8")
new Function("exports", ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(detector)

function readMark(mark) {
  const width = 1000
  const height = 200
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const column = Math.floor((x - 60) / 78)
      if (column < 0 || column >= 10) continue
      const dx = x - (99 + column * 78)
      const dy = y - 102
      const radius = Math.hypot(dx, dy)
      if (Math.abs(radius - 16) < 1 || (column === 0 && mark(dx, dy, radius))) {
        const index = (y * width + x) * 4
        data[index] = data[index + 1] = data[index + 2] = 35
      }
    }
  }
  return detector.analyzeBubbleScorecard({ width, height, data }, {
    stations: [{ stationNumber: 1, birdCount: 10 }],
    x: 0, y: 0, width: 1, stationColumnWidth: .06,
    totalColumnWidth: .08, runningColumnWidth: .08,
    headerHeight: .34, rowHeight: .34, birdColumns: 10,
  })[0]
}

for (const slope of [-1, 1]) {
  test(`diagonal slash ${slope} is a miss`, () => {
    assert.equal(readMark((x, y, r) => r < 26 && Math.abs(y - slope * x) < 2).state, "blank")
  })
}
test("filled bubble remains a hit even with a slash", () => {
  assert.equal(readMark((x, y, r) => r < 15 || (r < 26 && Math.abs(y + x) < 2)).state, "hit")
})
test("compact partial fill is not treated as a slash", () => {
  const reading = readMark((x, y) => Math.hypot(x - 2, y) < 5)
  assert.equal(reading.slash, false)
  assert.notEqual(reading.state, "blank")
})
test("vertical mark stays available for review", () => {
  const reading = readMark((x, y) => Math.abs(x) < 2 && Math.abs(y) < 15)
  assert.equal(reading.slash, false)
  assert.notEqual(reading.state, "blank")
})
test("empty bubble remains a miss", () => {
  assert.equal(readMark(() => false).state, "blank")
})
