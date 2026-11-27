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
      const state = store.getState();
      const tourActive = state.tour?.activeId != null;
      const journeyActive = state.journey?.activeId != null;
      const targetInteractive =
        target instanceof Element &&
        Boolean(
          target.closest(
            'button, a[href], summary, [role="button"], [role="radio"], [role="slider"], [role="tab"], [role="checkbox"], [role="switch"], [role="menuitem"]',
          ),
        );
      const cmd = shortcutFor({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        targetTag: target instanceof Element ? target.tagName : '',
        targetEditable:
          target instanceof HTMLElement ? target.isContentEditable : false,
        targetInteractive,
        tourActive,
        journeyActive,
      });
      if (!cmd) return;

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
          if (skeletalReady && !quizActive) {
            if (selectedIds.length > 0) {
              dispatch(selectionCleared());
            } else if (journeyActive) {
              void import('../features/journey/thunks').then(
                ({ exitJourney }) => dispatch(exitJourney()),
              );
            } else if (tourActive) {
              void import('../features/tours/thunks').then(({ exitTour }) =>
                dispatch(exitTour()),
              );
            }
          }
          break;
        case 'journey-toggle':
          e.preventDefault();
          if (
            skeletalReady &&
            !quizActive &&
            journeyActive &&
            state.journey.loadStatus !== 'error'
          ) {
            void Promise.all([
              import('../features/journey/journeySlice'),
              import('../features/motion/reducedMotion'),
            ]).then(([{ journeyPlayingSet }, { prefersReducedMotion }]) => {
              if (
                !prefersReducedMotion() &&
                store.getState().journey.loadStatus !== 'error'
              ) {
                dispatch(journeyPlayingSet(!store.getState().journey.playing));
              }
            });
          }
          break;
        case 'journey-next':
          e.preventDefault();
          if (skeletalReady && !quizActive && journeyActive) {
            void import('../features/journey/thunks').then(({ nextStage }) =>
              dispatch(nextStage()),
            );
          }
          break;
        case 'journey-prev':
          e.preventDefault();
          if (skeletalReady && !quizActive && journeyActive) {
            void import('../features/journey/thunks').then(({ prevStage }) =>
              dispatch(prevStage()),
            );
          }
          break;
        case 'tour-next':
          e.preventDefault();
          if (skeletalReady && !quizActive && tourActive) {
            void import('../features/tours/thunks').then(({ nextStep }) =>
              dispatch(nextStep()),
            );
          }
          break;
        case 'tour-prev':
          e.preventDefault();
          if (skeletalReady && !quizActive && tourActive) {
            void import('../features/tours/thunks').then(({ prevStep }) =>
              dispatch(prevStep()),
            );
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
