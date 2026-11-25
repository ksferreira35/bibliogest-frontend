import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { subscribeToSession } from '../auth.js'

function snapshot(account) {
  const signedIn = Boolean(account?.authenticated)
  return JSON.stringify({
    signedIn,
    subject: account?.tokenParsed?.sub || '',
    name:
      account?.tokenParsed?.name ||
      account?.tokenParsed?.preferred_username ||
      'Leitor',
    reader: signedIn && account?.hasRealmRole?.('LEITOR') === true,
    administrator:
      signedIn && account?.hasRealmRole?.('ADMINISTRADOR') === true,
    librarian: signedIn && account?.hasRealmRole?.('BIBLIOTECARIO') === true,
  })
}

export function useSession(account) {
  const subscribe = useCallback(
    (notify) => subscribeToSession(account, notify),
    [account],
  )
  const getSnapshot = useCallback(() => snapshot(account), [account])
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(() => JSON.parse(value), [value])
}
