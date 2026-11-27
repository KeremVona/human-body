import { describe, expect, it } from 'vitest';
import { shortcutFor } from './shortcuts';

const k = (key: string, o: Partial<Parameters<typeof shortcutFor>[0]> = {}) =>
  shortcutFor({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    targetTag: 'BODY',
    targetEditable: false,
    ...o,
  });

describe('shortcutFor', () => {
  it.each([
    ['h', 'hide'],
    ['H', 'hide'],
    ['i', 'isolate'],
    ['g', 'fade'],
    ['f', 'focus'],
    ['Escape', 'deselect'],
    ['1', 'preset:anterior'],
    ['2', 'preset:posterior'],
    ['3', 'preset:left'],
    ['4', 'preset:right'],
    ['5', 'preset:superior'],
    ['6', 'preset:inferior'],
    ['0', 'reset-view'],
    ['+', 'zoom-in'],
    ['=', 'zoom-in'],
    ['-', 'zoom-out'],
  ] as const)('%s -> %s', (key, cmd) => {
    expect(k(key)).toBe(cmd);
  });

  it('maps modifiers and pins', () => {
    expect(k('z', { ctrlKey: true })).toBe('undo');
    expect(k('z', { metaKey: true })).toBe('undo');
    expect(k('F10', { shiftKey: true })).toBe('context-menu');
    expect(k('z')).toBeNull();
    expect(k('/')).toBe('focus-search');
    expect(k('p')).toBe('add-pin');
    expect(k('P')).toBe('add-pin');
    expect(k('x')).toBe('toggle-section');
    expect(k('X')).toBe('toggle-section');
  });

  it('ignores typing and Alt', () => {
    expect(k('h', { targetTag: 'INPUT' })).toBeNull();
    expect(k('/', { targetTag: 'INPUT' })).toBeNull();
    expect(k('p', { targetTag: 'INPUT' })).toBeNull();
    expect(k('x', { targetTag: 'INPUT' })).toBeNull();
    expect(k('h', { targetTag: 'TEXTAREA' })).toBeNull();
    expect(k('h', { targetTag: 'SELECT' })).toBeNull();
    expect(k('h', { targetEditable: true })).toBeNull();
    expect(k('h', { altKey: true })).toBeNull();
  });

  it('maps ArrowRight and ArrowLeft only when tourActive is true', () => {
    expect(k('ArrowRight')).toBeNull();
    expect(k('ArrowLeft')).toBeNull();
    expect(k('ArrowRight', { tourActive: false })).toBeNull();
    expect(k('ArrowRight', { tourActive: true })).toBe('tour-next');
    expect(k('ArrowLeft', { tourActive: true })).toBe('tour-prev');
    expect(k('ArrowRight', { tourActive: true, targetTag: 'INPUT' })).toBeNull();
  });

  it('maps Space, ArrowRight and ArrowLeft when journeyActive is true', () => {
    expect(k(' ')).toBeNull();
    expect(k(' ', { journeyActive: true })).toBe('journey-toggle');
    expect(k(' ', { journeyActive: true, targetInteractive: true })).toBeNull();
    expect(k('ArrowRight', { journeyActive: true })).toBe('journey-next');
    expect(k('ArrowLeft', { journeyActive: true })).toBe('journey-prev');
    expect(k(' ', { journeyActive: true, targetTag: 'INPUT' })).toBeNull();
  });
});
