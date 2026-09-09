const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = readFileSync(join(__dirname, '../src/lib/services/digitalScoring.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText

function loader(rows, cap = 1000, failAt = Infinity) {
  const calls = []
  const supabase = {
    from(table) {
      assert.equal(table, 'digital_scorecard_station_scores')
      const filters = {}
      const query = {
        select() { return query },
        eq(key, value) { filters[key] = value; return query },
        order(key) { assert.equal(key, 'id'); return query },
        async range(from, to) {
          assert.deepEqual(filters, { organization_id: 'org', event_id: 'event' })
          calls.push([from, to])
          if (from >= failAt) return { error: { message: 'Page unavailable' } }
          return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }
        },
      }
      return query
    },
  }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require(name) { assert.equal(name, '@/lib/supabase'); return { supabase } },
  })
  return { run: () => exports.loadDigitalStationScores('org', 'event'), calls }
}

test('loads all 170 twelve-station scorecards across the row limit', async () => {
  const rows = Array.from({ length: 2040 }, (_, i) => ({
    id: String(i).padStart(5, '0'), scorecard_id: `card-${Math.floor(i / 12)}`,
    station_id: `station-${i % 12}`, hits: i % 9, notes: null,
  }))
  const { run, calls } = loader(rows)
  const result = await run()
  assert.equal(result.length, 2040)
  assert.equal(result.filter(row => row.scorecard_id === 'card-169').length, 12)
  assert.equal(new Set(result.map(row => row.id)).size, 2040)
  assert.deepEqual(Array.from(result), rows)
  assert.equal(calls.at(-1)[0], 2040)
})

test('continues when the configured server limit is smaller than a requested page', async () => {
  const rows = Array.from({ length: 720 }, (_, id) => ({ id }))
  const { run } = loader(rows, 100)
  assert.equal((await run()).length, 720)
})

test('handles empty events', async () => {
  const { run, calls } = loader([])
  assert.equal((await run()).length, 0)
  assert.equal(calls.length, 1)
})

test('rejects a failed later page instead of returning incomplete scores', async () => {
  const { run } = loader(Array.from({ length: 1200 }, (_, id) => ({ id })), 1000, 500)
  await assert.rejects(run, /Page unavailable/)
})
