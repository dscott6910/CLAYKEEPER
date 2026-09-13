import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"
import pngjs from "pngjs"

// Run against a rendered scan and independently reviewed per-station hit lists.
const [imagePath, expectedPath] = process.argv.slice(2)
if (!imagePath || !expectedPath) {
  throw new Error("Usage: node scripts/check-scorecard-scan.mjs scan.png expected-hits.json")
}
const expected = JSON.parse(readFileSync(expectedPath, "utf8"))
const pageSource = readFileSync(new URL("../src/features/scorecards/ScorecardScanLabPage.tsx", import.meta.url), "utf8")
const ast = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const constantNames = new Set(["CARD_WIDTH", "CARD_HEIGHT", "TABLE_X", "TABLE_Y", "TABLE_WIDTH", "STATION_WIDTH", "TOTAL_WIDTH", "RUNNING_WIDTH", "ROW_HEIGHT"])
const selected = ast.statements.filter(statement =>
  (ts.isFunctionDeclaration(statement) && ["buildTemplate", "markerCenters"].includes(statement.name?.text)) ||
  (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => constantNames.has(declaration.name.getText(ast)))),
).map(statement => statement.getText(ast)).join("\n")
const helpers = new Function(`${ts.transpile(selected, { target: ts.ScriptTarget.ES2022 })}; return {buildTemplate, markerCenters}`)()
const detectorSource = readFileSync(new URL("../src/lib/scorecards/gridScorecardDetector.ts", import.meta.url), "utf8")
const detector = {}
new Function("exports", ts.transpile(detectorSource, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(detector)
globalThis.ImageData = class {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}
const png = pngjs.PNG.sync.read(readFileSync(imagePath))
const image = new ImageData(png.width, png.height)
image.data.set(png.data)
const stations = expected.map((station, index) => ({ station_number: index + 1, bird_count: station.birds }))
const centers = helpers.markerCenters(stations.length)
const markers = detector.detectRegistrationMarkers(image, centers)
assert.equal(markers.length, 4, "All four markers must be detected")
const corrected = detector.warpUsingMarkerTemplate(image, markers.map(marker => marker.center), centers, 1100, 1700)
const readings = detector.analyzeBubbleScorecard(corrected, helpers.buildTemplate(stations))
for (const reading of readings) {
  const state = expected[reading.station - 1].hits.includes(reading.bird) ? "hit" : "blank"
  assert.equal(reading.state, state, `Station ${reading.station}, bird ${reading.bird}`)
}
console.log(`Passed: 4 markers, ${readings.length} bubbles, ${readings.filter(reading => reading.state === "hit").length} hits; using the single/batch screen's actual calibration.`)
