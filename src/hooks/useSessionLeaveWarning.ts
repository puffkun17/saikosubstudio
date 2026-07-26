'use client';

import { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';

/**
 * 最低风险离开提示：有实际会话数据时注册 beforeunload。
 * 只触发浏览器系统对话框，用户仍可选择离开；不做 history 拦截或困住返回。
 */
export function useSessionLeaveWarning() {
  const hasSessionWork = useStudioStore((state) => (
    state.tasks.length > 0
    || state.uploadedFiles.length > 0
    || Boolean(state.processedSubs?.length)
  ));

  useEffect(() => {
    if (!hasSessionWork) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome 等仍要求 returnValue 才会弹出系统提示；文案不可定制。
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasSessionWork]);
}
