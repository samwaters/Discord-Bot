export interface IPayload {
  op: number
  d?: any
  s?: number
  t?: string
}

export const validatePayload = (payload: IPayload): boolean => {
  if(!payload.op || JSON.stringify(payload).length > 4096) {
    return false
  }
  return true
}

