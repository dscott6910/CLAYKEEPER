export type Point = {
  x: number
  y: number
}

export type BubbleState = "filled" | "empty" | "uncertain"

export type RegistrationMarker = {
  center: Point
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  score: number
}

export type BubbleReading = {
  stationIndex: number
  birdIndex: number
  x: number
  y: number
  rawScore: number
  state: BubbleState
}

export type OmrTemplate = {
  stationCount: number
  birdsPerStation: number
  firstBubbleX: number
  lastBubbleX: number
  firstBubbleY: number
  lastBubbleY: number
  sampleRadius: number
  backgroundRadius: number
}

export type MarkerTemplate = {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function luminance(red: number, green: number, blue: number) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function pixelLuminance(image: ImageData, x: number, y: number) {
  const safeX = Math.max(0, Math.min(image.width - 1, Math.round(x)))
  const safeY = Math.max(0, Math.min(image.height - 1, Math.round(y)))
  const index = (safeY * image.width + safeX) * 4

  return luminance(
    image.data[index],
    image.data[index + 1],
    image.data[index + 2],
  )
}

function otsuThreshold(image: ImageData) {
  const histogram = new Array<number>(256).fill(0)
  let total = 0

  for (let y = 0; y < image.height; y += 2) {
    for (let x = 0; x < image.width; x += 2) {
      const value = Math.round(pixelLuminance(image, x, y))
      histogram[value] += 1
      total += 1
    }
  }

  let weightedSum = 0
  for (let value = 0; value < 256; value += 1) {
    weightedSum += value * histogram[value]
  }

  let backgroundWeight = 0
  let backgroundSum = 0
  let bestVariance = -1
  let bestThreshold = 128

  for (let threshold = 0; threshold < 256; threshold += 1) {
    backgroundWeight += histogram[threshold]
    if (backgroundWeight === 0) continue

    const foregroundWeight = total - backgroundWeight
    if (foregroundWeight === 0) break

    backgroundSum += threshold * histogram[threshold]

    const backgroundMean = backgroundSum / backgroundWeight
    const foregroundMean =
      (weightedSum - backgroundSum) / foregroundWeight

    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) ** 2

    if (variance > bestVariance) {
      bestVariance = variance
      bestThreshold = threshold
    }
  }

  return Math.max(70, Math.min(190, bestThreshold))
}

function finderPatternScore(
  image: ImageData,
  bounds: RegistrationMarker["bounds"],
  threshold: number,
) {
  const grid = 21
  let outerDark = 0
  let outerCount = 0
  let middleLight = 0
  let middleCount = 0
  let centerDark = 0
  let centerCount = 0

  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const nx = (gx + 0.5) / grid
      const ny = (gy + 0.5) / grid
      const x = bounds.x + nx * bounds.width
      const y = bounds.y + ny * bounds.height
      const dark = pixelLuminance(image, x, y) < threshold
      const edgeDistance = Math.min(nx, ny, 1 - nx, 1 - ny)

      if (edgeDistance < 0.18) {
        outerCount += 1
        if (dark) outerDark += 1
      } else if (edgeDistance < 0.34) {
        middleCount += 1
        if (!dark) middleLight += 1
      } else {
        centerCount += 1
        if (dark) centerDark += 1
      }
    }
  }

  return (
    (outerCount ? outerDark / outerCount : 0) * 0.42 +
    (middleCount ? middleLight / middleCount : 0) * 0.28 +
    (centerCount ? centerDark / centerCount : 0) * 0.30
  )
}

export function detectRegistrationMarkers(
  image: ImageData,
): RegistrationMarker[] {
  const threshold = otsuThreshold(image)
  const width = image.width
  const height = image.height
  const minDimension = Math.min(width, height)
  const minSize = Math.max(18, Math.round(minDimension * 0.025))
  const maxSize = Math.round(minDimension * 0.18)

  const binary = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      binary[y * width + x] =
        pixelLuminance(image, x, y) < threshold ? 1 : 0
    }
  }

  const visited = new Uint8Array(width * height)
  const queueX = new Int32Array(width * height)
  const queueY = new Int32Array(width * height)
  const candidates: RegistrationMarker[] = []

  for (let startY = 0; startY < height; startY += 1) {
    for (let startX = 0; startX < width; startX += 1) {
      const startIndex = startY * width + startX
      if (!binary[startIndex] || visited[startIndex]) continue

      let head = 0
      let tail = 0
      queueX[tail] = startX
      queueY[tail] = startY
      tail += 1
      visited[startIndex] = 1

      let minX = startX
      let maxX = startX
      let minY = startY
      let maxY = startY
      let area = 0

      while (head < tail) {
        const x = queueX[head]
        const y = queueY[head]
        head += 1
        area += 1

        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)

        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const index = ny * width + nx
          if (!binary[index] || visited[index]) continue

          visited[index] = 1
          queueX[tail] = nx
          queueY[tail] = ny
          tail += 1
        }
      }

      const componentWidth = maxX - minX + 1
      const componentHeight = maxY - minY + 1

      if (
        componentWidth < minSize ||
        componentHeight < minSize ||
        componentWidth > maxSize ||
        componentHeight > maxSize
      ) {
        continue
      }

      const aspectRatio = componentWidth / componentHeight
      if (aspectRatio < 0.72 || aspectRatio > 1.38) continue

      const density = area / (componentWidth * componentHeight)
      if (density < 0.12 || density > 0.88) continue

      const bounds = {
        x: minX,
        y: minY,
        width: componentWidth,
        height: componentHeight,
      }

      const patternScore = finderPatternScore(image, bounds, threshold)
      if (patternScore < 0.64) continue

      candidates.push({
        center: {
          x: minX + componentWidth / 2,
          y: minY + componentHeight / 2,
        },
        bounds,
        score: patternScore - Math.abs(1 - aspectRatio) * 0.15,
      })
    }
  }

  const targets = [
    { x: width * 0.14, y: height * 0.14 },
    { x: width * 0.86, y: height * 0.14 },
    { x: width * 0.86, y: height * 0.86 },
    { x: width * 0.14, y: height * 0.86 },
  ]

  const selected: RegistrationMarker[] = []

  for (const target of targets) {
    const candidate = candidates
      .filter((item) => {
        const left = target.x < width / 2
        const top = target.y < height / 2

        return (
          (left ? item.center.x < width / 2 : item.center.x >= width / 2) &&
          (top ? item.center.y < height / 2 : item.center.y >= height / 2)
        )
      })
      .map((item) => ({
        item,
        ranking:
          item.score -
          (Math.hypot(
            item.center.x - target.x,
            item.center.y - target.y,
          ) /
            Math.hypot(width, height)) *
            0.35,
      }))
      .sort((a, b) => b.ranking - a.ranking)[0]

    if (candidate) selected.push(candidate.item)
  }

  return selected.length === 4 ? selected : []
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length
  const augmented = matrix.map((row, index) => [...row, values[index]])

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column

    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-10) {
      throw new Error("Unable to calculate perspective correction.")
    }

    ;[augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ]

    const pivot = augmented[column][column]

    for (let c = column; c <= size; c += 1) {
      augmented[column][c] /= pivot
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]

      for (let c = column; c <= size; c += 1) {
        augmented[row][c] -= factor * augmented[column][c]
      }
    }
  }

  return augmented.map((row) => row[size])
}

function homography(source: Point[], destination: Point[]) {
  const matrix: number[][] = []
  const values: number[] = []

  for (let index = 0; index < 4; index += 1) {
    const { x, y } = source[index]
    const { x: u, y: v } = destination[index]

    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    values.push(u)

    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    values.push(v)
  }

  const result = solveLinearSystem(matrix, values)

  return [
    result[0],
    result[1],
    result[2],
    result[3],
    result[4],
    result[5],
    result[6],
    result[7],
    1,
  ]
}

function invert3x3(matrix: number[]) {
  const [a, b, c, d, e, f, g, h, i] = matrix
  const determinant =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g)

  if (Math.abs(determinant) < 1e-10) {
    throw new Error("Perspective transform is not invertible.")
  }

  return [
    (e * i - f * h) / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ]
}

function project(matrix: number[], point: Point): Point {
  const denominator =
    matrix[6] * point.x + matrix[7] * point.y + matrix[8]

  return {
    x:
      (matrix[0] * point.x +
        matrix[1] * point.y +
        matrix[2]) /
      denominator,
    y:
      (matrix[3] * point.x +
        matrix[4] * point.y +
        matrix[5]) /
      denominator,
  }
}

export function warpUsingMarkerTemplate(
  source: ImageData,
  sourceMarkerCenters: Point[],
  markerTemplate: MarkerTemplate,
  outputWidth = 1600,
  outputHeight = 1000,
) {
  const destinationMarkerCenters = [
    {
      x: markerTemplate.topLeft.x * outputWidth,
      y: markerTemplate.topLeft.y * outputHeight,
    },
    {
      x: markerTemplate.topRight.x * outputWidth,
      y: markerTemplate.topRight.y * outputHeight,
    },
    {
      x: markerTemplate.bottomRight.x * outputWidth,
      y: markerTemplate.bottomRight.y * outputHeight,
    },
    {
      x: markerTemplate.bottomLeft.x * outputWidth,
      y: markerTemplate.bottomLeft.y * outputHeight,
    },
  ]

  const forward = homography(
    sourceMarkerCenters,
    destinationMarkerCenters,
  )
  const inverse = invert3x3(forward)
  const output = new ImageData(outputWidth, outputHeight)

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const sourcePoint = project(inverse, { x, y })
      const sourceX = Math.round(sourcePoint.x)
      const sourceY = Math.round(sourcePoint.y)
      const destinationIndex = (y * outputWidth + x) * 4

      if (
        sourceX < 0 ||
        sourceX >= source.width ||
        sourceY < 0 ||
        sourceY >= source.height
      ) {
        output.data[destinationIndex] = 255
        output.data[destinationIndex + 1] = 255
        output.data[destinationIndex + 2] = 255
        output.data[destinationIndex + 3] = 255
        continue
      }

      const sourceIndex = (sourceY * source.width + sourceX) * 4
      output.data[destinationIndex] = source.data[sourceIndex]
      output.data[destinationIndex + 1] = source.data[sourceIndex + 1]
      output.data[destinationIndex + 2] = source.data[sourceIndex + 2]
      output.data[destinationIndex + 3] = 255
    }
  }

  return output
}

function ringScore(
  image: ImageData,
  centerX: number,
  centerY: number,
  radius: number,
) {
  let ringDarkness = 0
  let ringCount = 0
  let insideBrightness = 0
  let insideCount = 0

  const innerRadius = Math.max(2, radius * 0.45)
  const ringInner = Math.max(innerRadius + 1, radius * 0.72)
  const ringOuter = Math.max(ringInner + 1, radius * 1.22)

  for (let oy = -Math.ceil(ringOuter); oy <= Math.ceil(ringOuter); oy += 1) {
    for (let ox = -Math.ceil(ringOuter); ox <= Math.ceil(ringOuter); ox += 1) {
      const distance = Math.sqrt(ox * ox + oy * oy)

      if (distance <= innerRadius) {
        insideBrightness += pixelLuminance(
          image,
          centerX + ox,
          centerY + oy,
        )
        insideCount += 1
      } else if (distance >= ringInner && distance <= ringOuter) {
        ringDarkness +=
          255 -
          pixelLuminance(
            image,
            centerX + ox,
            centerY + oy,
          )
        ringCount += 1
      }
    }
  }

  const averageRingDarkness = ringCount ? ringDarkness / ringCount : 0
  const averageInsideBrightness = insideCount
    ? insideBrightness / insideCount
    : 255

  // Printed empty bubbles have a dark ring and usually a light center.
  // Filled bubbles still score well because the ring remains present.
  return averageRingDarkness * 0.8 + averageInsideBrightness * 0.2
}

function snapAxis(
  image: ImageData,
  expectedPositions: number[],
  fixedPositions: number[],
  axis: "x" | "y",
  searchRadius: number,
  bubbleRadius: number,
) {
  return expectedPositions.map((expected) => {
    let bestPosition = expected
    let bestScore = -Infinity

    for (
      let candidate = expected - searchRadius;
      candidate <= expected + searchRadius;
      candidate += 1
    ) {
      let score = 0

      for (const fixed of fixedPositions) {
        score +=
          axis === "x"
            ? ringScore(image, candidate, fixed, bubbleRadius)
            : ringScore(image, fixed, candidate, bubbleRadius)
      }

      if (score > bestScore) {
        bestScore = score
        bestPosition = candidate
      }
    }

    return bestPosition
  })
}

function measureBubble(
  image: ImageData,
  centerX: number,
  centerY: number,
  sampleRadius: number,
  backgroundRadius: number,
) {
  let centerLum = 0
  let centerCount = 0
  let darkCount = 0
  let backgroundLum = 0
  let backgroundCount = 0

  for (let oy = -backgroundRadius; oy <= backgroundRadius; oy += 1) {
    for (let ox = -backgroundRadius; ox <= backgroundRadius; ox += 1) {
      const distanceSquared = ox * ox + oy * oy
      if (distanceSquared > backgroundRadius ** 2) continue

      const value = pixelLuminance(image, centerX + ox, centerY + oy)

      if (distanceSquared <= sampleRadius ** 2) {
        centerLum += value
        centerCount += 1
        if (value < 160) darkCount += 1
      } else if (distanceSquared >= (sampleRadius + 3) ** 2) {
        backgroundLum += value
        backgroundCount += 1
      }
    }
  }

  const averageCenter = centerCount ? centerLum / centerCount : 255
  const averageBackground =
    backgroundCount ? backgroundLum / backgroundCount : 255
  const coverage = centerCount ? darkCount / centerCount : 0
  const darkness = clamp((averageBackground - averageCenter) / 120)

  return clamp(
    darkness * 0.58 +
      clamp((coverage - 0.05) / 0.70) * 0.42,
  )
}

function adaptiveThreshold(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b)
  const baselineValues = sorted.slice(
    0,
    Math.max(1, Math.floor(sorted.length * 0.70)),
  )
  const baseline =
    baselineValues.reduce((sum, value) => sum + value, 0) /
    baselineValues.length
  const highest = sorted.at(-1) ?? baseline
  const separation = highest - baseline

  return {
    threshold:
      separation > 0.12
        ? baseline + separation * 0.48
        : Math.max(0.24, baseline + 0.10),
    band: Math.max(0.025, separation * 0.10),
  }
}

export function analyzeOmrTemplate(
  image: ImageData,
  template: OmrTemplate,
) {
  const scale = Math.min(image.width, image.height)
  const sampleRadius = Math.max(
    4,
    Math.round(template.sampleRadius * scale),
  )
  const backgroundRadius = Math.max(
    sampleRadius + 4,
    Math.round(template.backgroundRadius * scale),
  )

  const expectedColumns = Array.from(
    { length: template.birdsPerStation },
    (_, birdIndex) =>
      template.birdsPerStation === 1
        ? ((template.firstBubbleX + template.lastBubbleX) / 2) *
          image.width
        : (template.firstBubbleX +
            ((template.lastBubbleX - template.firstBubbleX) *
              birdIndex) /
              (template.birdsPerStation - 1)) *
          image.width,
  )

  const expectedRows = Array.from(
    { length: template.stationCount },
    (_, stationIndex) =>
      template.stationCount === 1
        ? ((template.firstBubbleY + template.lastBubbleY) / 2) *
          image.height
        : (template.firstBubbleY +
            ((template.lastBubbleY - template.firstBubbleY) *
              stationIndex) /
              (template.stationCount - 1)) *
          image.height,
  )

  /*
   * Align the six bubble columns first.
   */
  const snappedColumns = snapAxis(
    image,
    expectedColumns,
    expectedRows,
    "x",
    Math.round(image.width * 0.018),
    sampleRadius * 1.4,
  )

  /*
   * Find the vertical row origin and pitch as one complete 15-row grid.
   *
   * The previous version snapped each row independently. On this scorecard,
   * the printed column headings and first filled marks could attract the
   * first overlay row, shifting the complete grid upward by one station.
   *
   * This version tests complete row sequences and chooses the origin/pitch
   * combination that produces the strongest bubble-ring response across
   * several rows and columns.
   */
  const expectedPitch =
    template.stationCount > 1
      ? (expectedRows[expectedRows.length - 1] - expectedRows[0]) /
        (template.stationCount - 1)
      : 0

  const sampleColumnIndexes = Array.from(
    new Set([
      0,
      Math.floor((snappedColumns.length - 1) / 2),
      snappedColumns.length - 1,
    ]),
  )

  const sampleRowIndexes = Array.from(
    new Set([
      0,
      1,
      Math.floor((template.stationCount - 1) / 2),
      template.stationCount - 2,
      template.stationCount - 1,
    ]),
  )

  let bestOrigin = expectedRows[0]
  let bestPitch = expectedPitch
  let bestGridScore = -Infinity

  const originSearchRadius = Math.max(
    8,
    Math.round(expectedPitch * 1.35),
  )

  const pitchFactors = [
    0.94,
    0.96,
    0.98,
    1,
    1.02,
    1.04,
    1.06,
  ]

  for (const pitchFactor of pitchFactors) {
    const candidatePitch = expectedPitch * pitchFactor

    for (
      let candidateOrigin = expectedRows[0] - originSearchRadius;
      candidateOrigin <= expectedRows[0] + originSearchRadius;
      candidateOrigin += 2
    ) {
      let gridScore = 0

      for (const rowIndex of sampleRowIndexes) {
        const rowY = candidateOrigin + candidatePitch * rowIndex

        for (const columnIndex of sampleColumnIndexes) {
          gridScore += ringScore(
            image,
            snappedColumns[columnIndex],
            rowY,
            sampleRadius * 1.4,
          )
        }
      }

      if (gridScore > bestGridScore) {
        bestGridScore = gridScore
        bestOrigin = candidateOrigin
        bestPitch = candidatePitch
      }
    }
  }

  /*
   * Build all 15 rows from the detected origin and pitch. Then allow only a
   * tiny local correction per row, which keeps the sequence from jumping to
   * the neighboring station.
   */
  /*
   * The V3 printed card has one non-scoring guide position immediately
   * above Station 1. The ring search can lock onto that guide and place
   * the complete overlay one row too high. Move the scoring grid down by
   * exactly one detected row pitch so Station 1 maps to the first real
   * scoring bubble.
   */
  const scoringRowOffset = bestPitch

  const detectedRows = Array.from(
    { length: template.stationCount },
    (_, stationIndex) =>
      bestOrigin + scoringRowOffset + bestPitch * stationIndex,
  )

  const snappedRows = snapAxis(
    image,
    detectedRows,
    snappedColumns,
    "y",
    Math.max(2, Math.round(bestPitch * 0.18)),
    sampleRadius * 1.4,
  )

  const readings: Omit<BubbleReading, "state">[] = []

  for (
    let stationIndex = 0;
    stationIndex < template.stationCount;
    stationIndex += 1
  ) {
    for (
      let birdIndex = 0;
      birdIndex < template.birdsPerStation;
      birdIndex += 1
    ) {
      const centerX = snappedColumns[birdIndex]
      const centerY = snappedRows[stationIndex]

      readings.push({
        stationIndex,
        birdIndex,
        x: centerX / image.width,
        y: centerY / image.height,
        rawScore: measureBubble(
          image,
          centerX,
          centerY,
          sampleRadius,
          backgroundRadius,
        ),
      })
    }
  }

  const { threshold, band } = adaptiveThreshold(
    readings.map((reading) => reading.rawScore),
  )

  return {
    threshold,
    band,
    readings: readings.map((reading) => ({
      ...reading,
      state:
        reading.rawScore >= threshold + band
          ? ("filled" as const)
          : reading.rawScore <= threshold - band
            ? ("empty" as const)
            : ("uncertain" as const),
    })),
  }
}
