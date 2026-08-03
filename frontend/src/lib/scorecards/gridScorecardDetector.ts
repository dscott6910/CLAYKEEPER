export type Point = {
  x: number
  y: number
}

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

export type GridCellState = "hit" | "blank" | "review"

export type GridCellReading = {
  station: number
  bird: number
  x: number
  y: number
  width: number
  height: number
  forwardDiagonal: number
  backwardDiagonal: number
  inkCoverage: number
  score: number
  state: GridCellState
}

export type GridTemplate = {
  markerCenters: readonly [Point, Point, Point, Point]
  blocks: Array<{
    stations: number[]
    x: number
    y: number
    width: number
    height: number
    stationColumnWidth: number
    totalColumnWidth: number
    headerHeight: number
  }>
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function luminance(red: number, green: number, blue: number) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function saturation(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  return max === 0 ? 0 : (max - min) / max
}

function pixel(image: ImageData, x: number, y: number) {
  const px = Math.max(0, Math.min(image.width - 1, Math.round(x)))
  const py = Math.max(0, Math.min(image.height - 1, Math.round(y)))
  const index = (py * image.width + px) * 4

  return {
    red: image.data[index],
    green: image.data[index + 1],
    blue: image.data[index + 2],
  }
}

function pixelLuminance(image: ImageData, x: number, y: number) {
  const value = pixel(image, x, y)
  return luminance(value.red, value.green, value.blue)
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
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue
          }

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
          (left
            ? item.center.x < width / 2
            : item.center.x >= width / 2) &&
          (top
            ? item.center.y < height / 2
            : item.center.y >= height / 2)
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
  const augmented = matrix.map((row, index) => [
    ...row,
    values[index],
  ])

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
  destinationMarkerCenters: readonly [Point, Point, Point, Point],
  outputWidth = 1600,
  outputHeight = 1000,
) {
  const destination = destinationMarkerCenters.map((point) => ({
    x: point.x * outputWidth,
    y: point.y * outputHeight,
  }))

  const forward = homography(sourceMarkerCenters, destination)
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
      output.data[destinationIndex + 1] =
        source.data[sourceIndex + 1]
      output.data[destinationIndex + 2] =
        source.data[sourceIndex + 2]
      output.data[destinationIndex + 3] = 255
    }
  }

  return output
}

function measureXWindow(
  image: ImageData,
  centerX: number,
  centerY: number,
  cellWidth: number,
  cellHeight: number,
) {
  /*
   * Search only near the expected cell center. The previous wide 5x5 search
   * could wander into neighboring grid lines and text, causing false hits.
   */
  const offsets = [-0.12, 0, 0.12]
  let best = {
    forwardDiagonal: 0,
    backwardDiagonal: 0,
    inkCoverage: 0,
    score: 0,
    state: "blank" as GridCellState,
  }

  for (const offsetY of offsets) {
    for (const offsetX of offsets) {
      const candidateCenterX = centerX + offsetX * cellWidth
      const candidateCenterY = centerY + offsetY * cellHeight

      /*
       * Analyze only the central portion of the cell so printed borders are
       * excluded even when the photographed grid is slightly misaligned.
       */
      const innerWidth = cellWidth * 0.58
      const innerHeight = cellHeight * 0.58
      const innerLeft = candidateCenterX - innerWidth / 2
      const innerTop = candidateCenterY - innerHeight / 2
      const innerRight = innerLeft + innerWidth
      const innerBottom = innerTop + innerHeight

      let localLight = 0
      let localCount = 0

      for (
        let py = Math.floor(innerTop);
        py <= Math.ceil(innerBottom);
        py += 1
      ) {
        for (
          let px = Math.floor(innerLeft);
          px <= Math.ceil(innerRight);
          px += 1
        ) {
          localLight += pixelLuminance(image, px, py)
          localCount += 1
        }
      }

      const localAverage = localCount
        ? localLight / localCount
        : 255

      /*
       * Require a pixel to be meaningfully darker than the local paper.
       * Colored pen is still accepted through saturation, but the saturation
       * threshold is deliberately stricter than before.
       */
      const darknessThreshold = Math.min(195, localAverage - 34)

      let totalPixels = 0
      let inkPixels = 0
      let centerPixels = 0
      let centerInk = 0

      let forwardCounts = [0, 0, 0, 0]
      let forwardInk = [0, 0, 0, 0]
      let backwardCounts = [0, 0, 0, 0]
      let backwardInk = [0, 0, 0, 0]

      const diagonalBand = 0.11

      for (
        let py = Math.floor(innerTop);
        py <= Math.ceil(innerBottom);
        py += 1
      ) {
        for (
          let px = Math.floor(innerLeft);
          px <= Math.ceil(innerRight);
          px += 1
        ) {
          const value = pixel(image, px, py)
          const lum = luminance(
            value.red,
            value.green,
            value.blue,
          )
          const sat = saturation(
            value.red,
            value.green,
            value.blue,
          )

          const marked =
            lum < darknessThreshold ||
            (sat > 0.42 && lum < localAverage - 10)

          const nx = (px - innerLeft) / innerWidth
          const ny = (py - innerTop) / innerHeight

          const quadrant =
            ny < 0.5
              ? nx < 0.5
                ? 0
                : 1
              : nx < 0.5
                ? 2
                : 3

          const forwardDistance = Math.abs(ny - nx)
          const backwardDistance = Math.abs(ny - (1 - nx))

          if (forwardDistance <= diagonalBand) {
            forwardCounts[quadrant] += 1
            if (marked) forwardInk[quadrant] += 1
          }

          if (backwardDistance <= diagonalBand) {
            backwardCounts[quadrant] += 1
            if (marked) backwardInk[quadrant] += 1
          }

          if (
            nx >= 0.34 &&
            nx <= 0.66 &&
            ny >= 0.34 &&
            ny <= 0.66
          ) {
            centerPixels += 1
            if (marked) centerInk += 1
          }

          totalPixels += 1
          if (marked) inkPixels += 1
        }
      }

      const forwardRatios = forwardCounts.map(
        (count, index) =>
          count > 0 ? forwardInk[index] / count : 0,
      )
      const backwardRatios = backwardCounts.map(
        (count, index) =>
          count > 0 ? backwardInk[index] / count : 0,
      )

      /*
       * A real X should contain both halves of both diagonals. Using the
       * weakest required quadrants prevents a single grid line, shadow, or
       * slash from becoming a hit.
       *
       * Forward diagonal uses top-left and bottom-right.
       * Backward diagonal uses top-right and bottom-left.
       */
      const forwardDiagonal = Math.min(
        forwardRatios[0],
        forwardRatios[3],
      )
      const backwardDiagonal = Math.min(
        backwardRatios[1],
        backwardRatios[2],
      )

      const inkCoverage = totalPixels
        ? inkPixels / totalPixels
        : 0
      const centerCoverage = centerPixels
        ? centerInk / centerPixels
        : 0

      const diagonalMinimum = Math.min(
        forwardDiagonal,
        backwardDiagonal,
      )
      const diagonalMaximum = Math.max(
        forwardDiagonal,
        backwardDiagonal,
      )
      const diagonalBalance =
        diagonalMaximum > 0
          ? diagonalMinimum / diagonalMaximum
          : 0

      const score = clamp(
        diagonalMinimum * 0.56 +
          diagonalBalance * 0.16 +
          clamp((centerCoverage - 0.035) / 0.30) * 0.18 +
          clamp((inkCoverage - 0.018) / 0.13) * 0.10,
      )

      if (score > best.score) {
        best = {
          forwardDiagonal,
          backwardDiagonal,
          inkCoverage,
          score,
          state: "blank",
        }
      }
    }
  }

  return best
}

export function analyzeGridScorecard(
  image: ImageData,
  template: GridTemplate,
): GridCellReading[] {
  const measured: GridCellReading[] = []

  for (const block of template.blocks) {
    const blockX = block.x * image.width
    const blockY = block.y * image.height
    const blockWidth = block.width * image.width
    const blockHeight = block.height * image.height
    const stationColumnWidth =
      block.stationColumnWidth * image.width
    const totalColumnWidth =
      block.totalColumnWidth * image.width
    const headerHeight = block.headerHeight * image.height
    const birdWidth =
      (blockWidth - stationColumnWidth - totalColumnWidth) / 6
    const rowHeight =
      (blockHeight - headerHeight) / block.stations.length

    for (
      let rowIndex = 0;
      rowIndex < block.stations.length;
      rowIndex += 1
    ) {
      for (let birdIndex = 0; birdIndex < 6; birdIndex += 1) {
        const cellX =
          blockX + stationColumnWidth + birdIndex * birdWidth
        const cellY =
          blockY + headerHeight + rowIndex * rowHeight

        const reading = measureXWindow(
          image,
          cellX + birdWidth / 2,
          cellY + rowHeight / 2,
          birdWidth,
          rowHeight,
        )

        measured.push({
          station: block.stations[rowIndex],
          bird: birdIndex + 1,
          x: cellX / image.width,
          y: cellY / image.height,
          width: birdWidth / image.width,
          height: rowHeight / image.height,
          ...reading,
        })
      }
    }
  }

  /*
   * Learn the blank-cell baseline from the card itself. Most scorecards have
   * more blank cells than marked cells, so the lower 70% gives a robust
   * estimate of printing, shadows, and camera noise.
   */
  const scores = measured
    .map((reading) => reading.score)
    .sort((left, right) => left - right)

  const baselineScores = scores.slice(
    0,
    Math.max(1, Math.floor(scores.length * 0.70)),
  )

  const baselineMedian =
    baselineScores[Math.floor(baselineScores.length / 2)] ?? 0

  const deviations = baselineScores
    .map((value) => Math.abs(value - baselineMedian))
    .sort((left, right) => left - right)

  const medianDeviation =
    deviations[Math.floor(deviations.length / 2)] ?? 0

  /*
   * The adaptive threshold handles different lighting and printer darkness,
   * while the absolute floor prevents a noisy card from classifying weak
   * marks as hits.
   */
  const hitThreshold = Math.max(
    0.38,
    baselineMedian + Math.max(0.16, medianDeviation * 7),
  )
  const reviewThreshold = Math.max(
    0.24,
    baselineMedian + Math.max(0.09, medianDeviation * 4),
  )

  return measured
    .map((reading) => {
      const hasTwoStrongDiagonals =
        reading.forwardDiagonal >= 0.22 &&
        reading.backwardDiagonal >= 0.22

      const balanced =
        Math.min(
          reading.forwardDiagonal,
          reading.backwardDiagonal,
        ) /
          Math.max(
            reading.forwardDiagonal,
            reading.backwardDiagonal,
            0.001,
          ) >=
        0.58

      const state: GridCellState =
        reading.score >= hitThreshold &&
        hasTwoStrongDiagonals &&
        balanced &&
        reading.inkCoverage >= 0.035
          ? "hit"
          : reading.score >= reviewThreshold ||
              reading.inkCoverage >= 0.075
            ? "review"
            : "blank"

      return {
        ...reading,
        state,
      }
    })
    .sort(
      (left, right) =>
        left.station - right.station ||
        left.bird - right.bird,
    )
}
