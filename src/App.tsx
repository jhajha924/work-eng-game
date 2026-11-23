// D8：依網址 hash 顯示今日任務頁或單字卡頁；同步在這一層建立一次，換頁不會中斷
import { getCardRepo, getRepo } from './app/storage'
import { TodayPage } from './app/TodayPage'
import { useHashRoute } from './app/useHashRoute'
import { CardsPage } from './cards/CardsPage'
import { useSync } from './sync/useSync'

function App() {
  const route = useHashRoute()
  const sync = useSync(getRepo, getCardRepo)
  return route === 'cards' ? <CardsPage sync={sync} /> : <TodayPage sync={sync} />
}

export default App
