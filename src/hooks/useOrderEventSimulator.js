import { useCallback } from 'react'
import { applyOrderEvent } from '../services/inventoryService'

export const useOrderEventSimulator = (setState, vendorId, orderItems) => {
  return useCallback(
    (eventType) => {
      setState((current) => applyOrderEvent(current, vendorId, eventType, orderItems))
    },
    [setState, vendorId, orderItems],
  )
}
