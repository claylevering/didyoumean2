import { distance } from 'fastest-levenshtein'

import { ReturnTypeEnums } from './enums/ReturnTypeEnums'
import { ThresholdTypeEnums } from './enums/ThresholdTypeEnums'
import { unknownReturnTypeError, unknownThresholdTypeError } from './errors'
import fillDefaultOptions from './lib/fillDefaultOptions'
import getSimilarity from './lib/getSimilarity'
import matchItemProcessor from './lib/matchItemProcessor'
import normalizeString from './lib/normalizeString'
import resultProcessor from './lib/resultProcessor'
import type { MatchItem, Options } from './types'

function didYouMean<T extends MatchItem>(
  input: string,
  matchList: ReadonlyArray<T>,
  options?: Partial<Options> & {
    readonly returnType?:
      | ReturnTypeEnums.FIRST_CLOSEST_MATCH
      | ReturnTypeEnums.FIRST_MATCH
  },
): T | null
function didYouMean<T extends MatchItem>(
  input: string,
  matchList: ReadonlyArray<T>,
  options: Partial<Options> & {
    readonly returnType:
      | ReturnTypeEnums.ALL_CLOSEST_MATCHES
      | ReturnTypeEnums.ALL_MATCHES
      | ReturnTypeEnums.ALL_SORTED_MATCHES
  },
  // eslint-disable-next-line functional/prefer-readonly-type
): Array<T>
/**
 * Main function for didyoumean2
 *
 * @param {string} input - string that you are not sure and want to match with `matchList`
 * @param {object[] | string[]} matchList - List for matching with `input`
 * @param {null | object | undefined} options - options that allows you to modify the behavior
 * @returns {Array | null | object | string} - matched result(s), return object if `match` is `{Object[]}`
 */
function didYouMean<T extends MatchItem>(
  input: string,
  matchList: ReadonlyArray<T>,
  options?: Partial<Options>,
): Array<T> | T | null {
  /*+++++++++++++++++++
   + Initiate options +
   +++++++++++++++++++*/

  const optionsWithDefaults = fillDefaultOptions(options)

  const { returnType, threshold, thresholdType } = optionsWithDefaults

  /*++++++++++++++++++++
   + Deal with options +
   ++++++++++++++++++++*/

  const normalizedInput = normalizeString(input, optionsWithDefaults)

  let checkIfMatched: (score: number) => boolean // Validate if score is matched
  let scoreProcessor: (matchItem: T) => number // Get score
  switch (thresholdType) {
    case ThresholdTypeEnums.EDIT_DISTANCE:
      checkIfMatched = (score: number) => score <= threshold
      scoreProcessor = (matchItem: T) =>
        distance(
          normalizedInput,
          matchItemProcessor(matchItem, optionsWithDefaults),
        )
      break

    case ThresholdTypeEnums.SIMILARITY:
      checkIfMatched = (score: number) => score >= threshold
      scoreProcessor = (matchItem: T) =>
        getSimilarity(
          normalizedInput,
          matchItemProcessor(matchItem, optionsWithDefaults),
        )
      break

    /* istanbul ignore next */ default:
      throw unknownThresholdTypeError
  }

  /*+++++++++++
   + Matching +
   +++++++++++*/

  const matchedIndexes: number[] = []

  switch (returnType) {
    case ReturnTypeEnums.ALL_CLOSEST_MATCHES:
    case ReturnTypeEnums.FIRST_CLOSEST_MATCH: {
      const scores: number[] = []

      let marginValue: number
      switch (thresholdType) {
        case ThresholdTypeEnums.EDIT_DISTANCE:
          // Process score and save the smallest score
          marginValue = Number.POSITIVE_INFINITY
          for (const matchItem of matchList) {
            const score = scoreProcessor(matchItem)

            if (marginValue > score) marginValue = score

            scores.push(score)
          }
          break

        case ThresholdTypeEnums.SIMILARITY:
          // Process score and save the largest score
          marginValue = 0
          for (const matchItem of matchList) {
            const score = scoreProcessor(matchItem)

            if (marginValue < score) marginValue = score

            scores.push(score)
          }
          break

        /* istanbul ignore next */ default:
          throw unknownThresholdTypeError
      }

      for (const [i, score] of scores.entries()) {
        if (checkIfMatched(score) && score === marginValue) {
          matchedIndexes.push(i)
        }
      }

      break
    }

    case ReturnTypeEnums.ALL_MATCHES:
      for (const [i, matchItem] of matchList.entries()) {
        const score = scoreProcessor(matchItem)

        // save all indexes of matched scores
        if (checkIfMatched(score)) {
          matchedIndexes.push(i)
        }
      }

      break

    case ReturnTypeEnums.ALL_SORTED_MATCHES: {
      const unsortedResults: Array<{
        readonly score: number
        readonly index: number
      }> = []
      for (const [i, matchItem] of matchList.entries()) {
        const score = scoreProcessor(matchItem)

        // save all indexes of matched scores
        if (checkIfMatched(score)) {
          unsortedResults.push({
            score,
            index: i,
          })
        }
      }

      switch (thresholdType) {
        case ThresholdTypeEnums.EDIT_DISTANCE:
          unsortedResults.sort((a, b) => a.score - b.score)
          break

        case ThresholdTypeEnums.SIMILARITY:
          unsortedResults.sort((a, b) => b.score - a.score)
          break

        /* istanbul ignore next */ default:
          throw unknownThresholdTypeError
      }

      for (const unsortedResult of unsortedResults) {
        matchedIndexes.push(unsortedResult.index)
      }

      break
    }

    case ReturnTypeEnums.FIRST_MATCH:
      for (const [i, matchItem] of matchList.entries()) {
        const score = scoreProcessor(matchItem)

        // Return once matched, performance is main target in this returnType
        if (checkIfMatched(score)) {
          matchedIndexes.push(i)
          break
        }
      }

      break

    /* istanbul ignore next */ default:
      throw unknownReturnTypeError
  }

  /*+++++++++++++++++++++++
   + Process return value +
   +++++++++++++++++++++++*/

  return resultProcessor(matchList, matchedIndexes, returnType)
}

export default didYouMean
export { ReturnTypeEnums, ThresholdTypeEnums }
