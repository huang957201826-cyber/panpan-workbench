import { create } from 'zustand'
import { INITIAL_UPDATE_STATE, updateReducer, type UpdateEvent, type UpdateState } from './appUpdate'

interface UpdateStore extends UpdateState {
  dispatch: (event: UpdateEvent) => void
}

/** 更新状态放在全局：侧栏版本入口与设置·关于页共用同一份，避免两处显示不一致 */
export const useAppUpdateStore = create<UpdateStore>((set) => ({
  ...INITIAL_UPDATE_STATE,
  dispatch: (event) => set((state) => updateReducer(state, event)),
}))
