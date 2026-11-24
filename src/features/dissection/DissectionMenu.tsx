import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { MeshId } from '../../data/ids';
import { useT } from '../../i18n/t';
import { useCameraApi } from '../../scene/camera';
import {
  fadeOthers,
  hide,
  isolate,
  selectHasDissection,
  showAll,
} from './dissectionSlice';

export type ContextMenuTarget = {
  x: number;
  y: number;
  meshIds: MeshId[];
  point?: [number, number, number] | null;
};

const itemClass =
  'flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-100 outline-none select-none data-[highlighted]:bg-sky-500/30 data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-40';

/** Controlled context menu anchored to a 1 px point for structure dissection or global reset actions. */
export function DissectionMenu({
  target,
  onClose,
}: {
  target: ContextMenuTarget | null;
  onClose: () => void;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const tr = useT();
  const cameraApi = useCameraApi();
  const hasDissection = useAppSelector(selectHasDissection);
  const quizStatus = useAppSelector((s) => s.quiz.status);

  const open = target !== null && quizStatus === 'off';
  const x = target?.x ?? 0;
  const y = target?.y ?? 0;
  const meshIds = target?.meshIds ?? [];

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DropdownMenu.Trigger asChild>
        <span
          aria-hidden="true"
          style={{ left: `${x}px`, top: `${y}px` }}
          className="pointer-events-none fixed z-40 h-px w-px"
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={tr('dissection.menuAria')}
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 min-w-40 rounded-xl border border-white/10 bg-slate-900/90 p-1 text-slate-100 shadow-2xl backdrop-blur-md"
        >
          {meshIds.length > 0 ? (
            <>
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => {
                  void cameraApi.focusMeshes(meshIds);
                }}
              >
                <span>{tr('dissection.focus')}</span>
                <kbd className="text-[10px] text-slate-400">F</kbd>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => {
                  dispatch(isolate(meshIds));
                  void cameraApi.focusMeshes(meshIds);
                }}
              >
                <span>{tr('dissection.isolate')}</span>
                <kbd className="text-[10px] text-slate-400">I</kbd>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => {
                  dispatch(hide(meshIds));
                }}
              >
                <span>{tr('dissection.hide')}</span>
                <kbd className="text-[10px] text-slate-400">H</kbd>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => {
                  dispatch(fadeOthers(meshIds));
                }}
              >
                <span>{tr('dissection.fadeOthers')}</span>
                <kbd className="text-[10px] text-slate-400">G</kbd>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => {
                  const first = meshIds[0];
                  if (!first) return;
                  void import('../pins/thunks').then(({ addPinAtPointer }) =>
                    dispatch(
                      addPinAtPointer({
                        meshId: first,
                        point: target?.point ?? null,
                      }),
                    ),
                  );
                }}
              >
                <span>{tr('dissection.addPin')}</span>
                <kbd className="text-[10px] text-slate-400">P</kbd>
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <DropdownMenu.Item
                disabled={!hasDissection}
                className={itemClass}
                onSelect={() => {
                  dispatch(showAll());
                }}
              >
                <span>{tr('dissection.showAll')}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => {
                  void cameraApi.resetView();
                }}
              >
                <span>{tr('dissection.resetView')}</span>
                <kbd className="text-[10px] text-slate-400">0</kbd>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
