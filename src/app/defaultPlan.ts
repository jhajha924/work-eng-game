// D9：預設計畫集中在這裡；之後的「建立計畫」設定畫面只要換掉這個來源
import sample from '../../content/packs/meeting-a2-b1-sample/pack.json'
import { buildSchedule } from '../plan/buildSchedule'
import type { ContentPack, PlanSettings } from '../plan/types'

export const defaultPack = sample as ContentPack

export const defaultSettings: PlanSettings = {
  startDate: '2026-11-02',
  length: { months: 6 },
  includeNovice: true,
  lightRanges: [],
}

export const defaultSchedule = buildSchedule([defaultPack], defaultSettings)
