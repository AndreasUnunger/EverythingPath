'use client';
import { useEffect, useRef } from 'react';

/** Where the editor's focus goes once it closes: its opener, else the heading. */
export function useFocusAfterEditorCloses(editorKey: string | null) {
  const wrapper = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const previousEditorKey = useRef(editorKey);
  useEffect(() => {
    const wasOpen = previousEditorKey.current !== null;
    previousEditorKey.current = editorKey;
    if (!wasOpen || editorKey !== null) return;
    const heading = wrapper.current?.querySelector<HTMLElement>('h2');
    const target = opener.current?.isConnected ? opener.current : heading;
    opener.current = null;
    if (!target) return;
    if (target === heading) target.tabIndex = -1;
    target.focus();
  }, [editorKey]);
  return {
    wrapper,
    rememberOpener: (element: HTMLElement) => {
      opener.current = element;
    },
  };
}
