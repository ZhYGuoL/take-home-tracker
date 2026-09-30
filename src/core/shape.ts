import { isValidZone } from './deadline'
import {
  type Candidate,
  type Deadline,
  type Entry,
  LINK_KINDS,
  type Link,
  SOURCES,
  STAGES,
} from './types'

/**
 * Checks for data read from her Sheet. She can edit the Sheet by hand, so a row can be valid
 * JSON and still not be a record. The app skips such a row instead of failing on it (D3).
 */

type Obj = Record<string, unknown>

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string'
const isTime = (x: unknown): x is string => isStr(x) && !Number.isNaN(Date.parse(x))
const isStrs = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr)
const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T =>
  isStr(x) && (list as readonly string[]).includes(x)

function isDeadline(x: unknown): x is Deadline {
  return (
    isObj(x) &&
    isTime(x.at) &&
    isStr(x.zone) &&
    isValidZone(x.zone) &&
    typeof x.dateOnly === 'boolean'
  )
}

const isLink = (x: unknown): x is Link => isObj(x) && isStr(x.url) && oneOf(LINK_KINDS, x.kind)

function isApplied(x: unknown): boolean {
  if (!isObj(x) || !isStrs(x.contacts)) return false
  if (x.takeHomeUrl !== null && !isStr(x.takeHomeUrl)) return false
  const d = x.deadline
  return (
    d === null || (isObj(d) && (d.before === null || isDeadline(d.before)) && isDeadline(d.after))
  )
}

export function isCandidate(x: unknown): x is Candidate {
  return (
    isObj(x) &&
    isStr(x.id) &&
    isStr(x.name) &&
    isStr(x.role) &&
    oneOf(SOURCES, x.source) &&
    isStrs(x.contacts) &&
    (x.sentAt === null || isTime(x.sentAt)) &&
    (x.deadline === null || isDeadline(x.deadline)) &&
    isStr(x.takeHomeUrl) &&
    isStr(x.notes) &&
    isTime(x.createdAt) &&
    (x.createdFrom === undefined || isStr(x.createdFrom))
  )
}

export function isEntry(x: unknown): x is Entry {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.candidateId) || !isTime(x.at)) return false
  switch (x.kind) {
    case 'message':
      return (
        (x.direction === 'in' || x.direction === 'out') &&
        isStr(x.text) &&
        oneOf(SOURCES, x.source) &&
        Array.isArray(x.links) &&
        x.links.every(isLink) &&
        typeof x.needsReply === 'boolean' &&
        (x.applied === undefined || isApplied(x.applied))
      )
    case 'stage':
      return oneOf(STAGES, x.stage)
    case 'opened':
      return isStr(x.url)
    case 'replied':
      return true
    default:
      return false
  }
}
