import { useState, useEffect } from 'react'

const STORAGE_KEY = 'fables_hide_homebrew'

export function getHomebrewFilterValue(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function setHomebrewFilterValue(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled))
  window.dispatchEvent(new Event('fables:homebrew-filter'))
}

export function useHomebrewFilter(): boolean {
  const [hideHomebrew, setHideHomebrew] = useState<boolean>(getHomebrewFilterValue)

  useEffect(() => {
    const handler = () => setHideHomebrew(getHomebrewFilterValue())
    window.addEventListener('fables:homebrew-filter', handler)
    return () => window.removeEventListener('fables:homebrew-filter', handler)
  }, [])

  return hideHomebrew
}
