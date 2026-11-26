import { useEffect } from 'react';
import { useStore } from 'react-redux';
import {
  fadeOthers,
  hide,
  isolate,
  undo,
} from '../features/dissection/dissectionSlice';
import { sectionToggled } from '../features/section/sectionSlice';
import { selectionCleared } from '../features/selection/selectionSlice';
import { useCameraApi, type Preset } from '../scene/camera';
import { useAppDispatch } from './hooks';
import { shortcutFor } from './shortcuts';
import type { RootState } from './store';

/** Registers global viewer keyboard shortcuts while skipping inputs and Alt-combos. */
export function useShortcuts(onContextMenu?: () => void): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const cameraApi = useCameraApi();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (
        typeof document !== 'undefined' &&
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }
      const target = e.target;
      const cmd = shortcutFor({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        targetTag: target instanceof Element ? target.tagName : '',
        targetEditable:
          target instanceof HTMLElement ? target.isContentEditable : false,
      });
      if (!cmd) return;

      const state = store.getState();
      const selectedIds = state.selection.selectedIds;
      const quizActive = state.quiz.status !== 'off';
      const skeletalReady = state.assets.bundles.skeletal === 'ready';

      switch (cmd) {
        case 'hide':
          if (skeletalReady && !quizActive && selectedIds.length > 0) {
            dispatch(hide(selectedIds));
          }
          break;
        case 'isolate':
          if (skeletalReady && !quizActive && selectedIds.length > 0) {
            dispatch(isolate(selectedIds));
            void cameraApi.focusMeshes(selectedIds);
          }
          break;
        case 'fade':
          if (skeletalReady && !quizActive && selectedIds.length > 0) {
            dispatch(fadeOthers(selectedIds));
          }
          break;
        case 'focus':
          if (skeletalReady && !quizActive && selectedIds.length > 0) {
            void cameraApi.focusMeshes(selectedIds);
          }
          break;
        case 'undo':
          e.preventDefault();
          if (skeletalReady && !quizActive) dispatch(undo());
          break;
        case 'add-pin':
          if (skeletalReady && !quizActive && selectedIds.length > 0) {
            void import('../features/pins/thunks').then(({ addPinAtPointer }) =>
              dispatch(addPinAtPointer()),
            );
          }
          break;
        case 'toggle-section':
          if (skeletalReady && !quizActive) {
            dispatch(sectionToggled());
          }
          break;
        case 'deselect':
          if (skeletalReady && !quizActive && selectedIds.length > 0) {
            dispatch(selectionCleared());
          }
          break;
        case 'context-menu':
          e.preventDefault();
          if (skeletalReady) {
            onContextMenu?.();
          }
          break;
        case 'focus-search': {
          e.preventDefault();
          const input = document.querySelector<HTMLElement>(
            '[data-slot="search"] input[role="combobox"], [role="combobox"][aria-autocomplete="list"]',
          );
          input?.focus();
          break;
        }
        case 'zoom-in':
          cameraApi.zoom(1);
          break;
        case 'zoom-out':
          cameraApi.zoom(-1);
          break;
        case 'reset-view':
          void cameraApi.resetView();
          break;
        default: {
          const preset = cmd.slice('preset:'.length) as Preset;
          void cameraApi.goToPreset(preset);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, store, cameraApi, onContextMenu]);
}
