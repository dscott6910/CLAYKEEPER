import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const source = readFileSync(new URL("../src/lib/scorecards/gridScorecardDetector.ts", import.meta.url), "utf8")
const detector = {}
new Function("exports", ts.transpile(source, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(detector)

const template = {
  x: 0, y: 0, width: 1, stationColumnWidth: 0,
  totalColumnWidth: 0, runningColumnWidth: 0, headerHeight: 0,
  rowHeight: 0.1, birdColumns: 10,
  stations: Array.from({ length: 10 }, (_, i) => ({ stationNumber: i + 1, birdCount: 10 })),
}

// The same pencil mark must not change state because other cells are filled.
for (const hitCount of [0, 11, 47, 71, 96, 100]) {
  for (const ink of [60, 180, 210]) {
    const image = { width: 500, height: 500, data: new Uint8ClampedArray(500 * 500 * 4).fill(255) }
    for (let y = 0; y < 500; y++) {
      for (let x = 0; x < 500; x++) {
        const cell = Math.floor(y / 50) * 10 + Math.floor(x / 50)
        const distance = Math.hypot(x % 50 - 25, y % 50 - 25)
        const value = distance >= 9 && distance <= 11 ? 100 : cell < hitCount && distance < 9 ? ink : 250
        const offset = (y * 500 + x) * 4
        image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = value
      }
    }
    const readings = detector.analyzeBubbleScorecard(image, template)
    assert.equal(readings.length, 100)
    readings.forEach((reading, i) => assert.equal(reading.state, i < hitCount ? "hit" : "blank", `hits=${hitCount}, ink=${ink}, cell=${i}`))
  }
}
console.log("Passed 1,800 bubble checks: empty through fully filled cards, dark and pale pencil, printed outlines.")
