import type { ModelReading } from '../core/extract/model'
import type { ExtractContext } from '../core/extract/types'

/** POST /api/extract */
export interface ExtractRequest {
  paste: string
  ctx: ExtractContext
}

export type ExtractResponse = { reading: ModelReading } | { error: ExtractError }

export type ExtractError = 'model_off' | 'not_allowed' | 'too_many' | 'model_failed' | 'bad_request'

/** The most text the Worker sends to a model. A pasted message is at most this long (D3). */
export const MAX_EXTRACT = 20_000
