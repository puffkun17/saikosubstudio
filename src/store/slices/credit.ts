import type { StateCreator } from 'zustand';
import type { StudioState } from '../types';

export type CreditSlice = Pick<
  StudioState,
  | 'creatorCredit'
  | 'appendCreatorCredit'
  | 'keepOriginalCredit'
  | 'setKeepOriginalCredit'
  | 'isOfficialSubtitle'
  | 'isOriginalWork'
  | 'creditDeclaration'
  | 'creditPlacement'
  | 'setCreatorCredit'
  | 'setAppendCreatorCredit'
  | 'setIsOfficialSubtitle'
  | 'setIsOriginalWork'
  | 'setCreditDeclaration'
  | 'setCreditPlacement'
>;

export const createCreditSlice: StateCreator<StudioState, [], [], CreditSlice> = (set) => ({
  creatorCredit: '',
  appendCreatorCredit: false,
  keepOriginalCredit: true,
  setKeepOriginalCredit: (keepOriginalCredit) => set({ keepOriginalCredit }),
  isOfficialSubtitle: false,
  isOriginalWork: false,
  creditDeclaration: 'none',
  creditPlacement: 'after-last',
  setCreatorCredit: (creatorCredit) => set({ creatorCredit }),
  setAppendCreatorCredit: (appendCreatorCredit) => set({ appendCreatorCredit }),
  setIsOfficialSubtitle: (isOfficialSubtitle) => set((state) => ({ isOfficialSubtitle, isOriginalWork: isOfficialSubtitle ? false : state.isOriginalWork })),
  setIsOriginalWork: (isOriginalWork) => set((state) => ({
    isOriginalWork,
    isOfficialSubtitle: isOriginalWork ? false : state.isOfficialSubtitle,
    // 原创关闭时，我的署名一并撤下（署名只在原创下可编辑）。
    appendCreatorCredit: isOriginalWork ? state.appendCreatorCredit : false,
    creditDeclaration: isOriginalWork ? 'original' : 'none',
  })),
  setCreditDeclaration: (creditDeclaration) => set({ creditDeclaration }),
  setCreditPlacement: (creditPlacement) => set({ creditPlacement }),
});
