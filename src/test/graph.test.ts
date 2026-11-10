import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Graph from '../components/Graph';
import { buildLinkIndex } from '../lib/links';
import type { Note } from '../lib/vault';

const notes: Note[] = [
  { id: 'a', title: 'Ideia A', content: '[[Ideia B]]' },
  { id: 'b', title: 'Ideia B', content: '[[Ideia A]]' },
].map(note => ({
  ...note, kind: 'note', folder: '', favorite: false, tags: [],
  deleted_at: null, version: 1, created_at: '', updated_at: '',
}));
const links = buildLinkIndex(notes);
const open = vi.fn();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  localStorage.clear();
  open.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  render();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render() {
  act(() => root.render(createElement(Graph, { notes, links, scope: 'test', selected: null, onOpen: open })));
  container.querySelector('svg.graph-surface')!.setPointerCapture = vi.fn();
}

function point(target: Element, type: string, x: number, y: number, pointerType = 'mouse', pointerId = 1) {
  act(() => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, clientX: x, clientY: y, button: 0, pointerType, pointerId,
  })));
}

it('keeps a dragged node pinned across graph remounts and does not open its note', () => {
  const node = container.querySelector('[data-node-id="a"]')!;
  const canvas = container.querySelector('.graph-surface')!;
  expect(container.querySelectorAll('.graph-edge')).toHaveLength(1);
  const before = node.getAttribute('transform');
  point(node, 'pointerdown', 20, 20);
  point(canvas, 'pointermove', 95, 54);
  point(canvas, 'pointerup', 95, 54);
  const after = node.getAttribute('transform');
  expect(after).not.toBe(before);
  expect(open).not.toHaveBeenCalled();
  act(() => root.render(null));
  render();
  expect(container.querySelector('[data-node-id="a"]')!.getAttribute('transform')).toBe(after);
  act(() => container.querySelector<HTMLButtonElement>('[aria-label="Reorganizar grafo"]')!.click());
  expect(container.querySelector('[data-node-id="a"]')!.getAttribute('transform')).toBe(before);
});

it('lets a touch preview a note and a pinch zoom without opening either note', () => {
  const node = container.querySelector('[data-node-id="a"]')!;
  const canvas = container.querySelector('.graph-surface')!;
  point(node, 'pointerdown', 20, 20, 'touch');
  point(canvas, 'pointerup', 20, 20, 'touch');
  expect(open).not.toHaveBeenCalled();
  act(() => container.querySelector<HTMLButtonElement>('.graph-inspector button')!.click());
  expect(open).toHaveBeenCalledWith('a');
  open.mockClear();

  point(node, 'pointerdown', 20, 20, 'touch');
  point(canvas, 'pointerdown', 70, 20, 'touch', 2);
  point(canvas, 'pointermove', 120, 20, 'touch', 2);
  point(canvas, 'pointerup', 120, 20, 'touch', 2);
  point(canvas, 'pointerup', 20, 20, 'touch');
  expect(container.querySelector('.graph-controls span')!.textContent).toBe('200%');
  expect(open).not.toHaveBeenCalled();
});
