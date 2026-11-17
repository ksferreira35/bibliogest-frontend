export function stockDeltaForStatusChange(previousStatus, nextStatus) {
  if (previousStatus !== 'Cancelada' && nextStatus === 'Cancelada') return 1
  if (previousStatus === 'Cancelada' && nextStatus !== 'Cancelada') return -1
  return 0
}
