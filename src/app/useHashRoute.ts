// D8：用網址 hash 切換頁面（只有兩頁，不另外引入路由套件）
import { useEffect, useState } from 'react'

export type Route = 'today' | 'cards'

/** `#/cards` 是單字卡頁，其他都是今日任務頁 */
export function routeFromHash(hash: string): Route {
  return hash === '#/cards' ? 'cards' : 'today'
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
