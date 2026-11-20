import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StartPage from '../components/StartPage';
import type { Note } from '../lib/vault';

function makeNote(id: string, title: string, updated_at = '2026-11-20T12:00:00.000Z'): Note {
  return {
    id,
    kind: 'note',
    title,
    content: '',
    folder: 'Comece por aqui',
    tags: [],
    favorite: false,
    deleted_at: null,
    version: 1,
    created_at: updated_at,
    updated_at,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('StartPage — fluxo da primeira nota', () => {
  it('destaca a criação da primeira nota no espaço vazio e permite criar com ou sem título', () => {
    const onQuickCreate = vi.fn();
    const onCreate = vi.fn();

    act(() => {
      root.render(createElement(StartPage, {
        notes: [],
        isDemo: false,
        hasCreatedNote: false,
        onCreate,
        onQuickCreate,
        onSearch: vi.fn(),
        onGraph: vi.fn(),
        onLibrary: vi.fn(),
        onDaily: vi.fn(),
        onOpen: vi.fn(),
        formatDate: () => '20 nov',
      }));
    });

    expect(container.querySelector('#start-title')?.textContent).toBe('Crie sua primeira nota');
    const input = container.querySelector<HTMLInputElement>('#start-first-note-title')!;
    const submit = container.querySelector<HTMLButtonElement>('.start-composer-submit')!;

    // Submit without typing creates a note with default title and focuses title
    act(() => submit.click());
    expect(onQuickCreate).toHaveBeenCalledWith({ title: 'Minha primeira nota', focus: 'title' });

    // Submit with typed title creates note with typed title and focuses body
    onQuickCreate.mockClear();
    act(() => setInputValue(input, 'Plano de estudos'));
    act(() => submit.click());
    expect(onQuickCreate).toHaveBeenCalledWith({ title: 'Plano de estudos', focus: 'body' });
    expect(input.value).toBe('');

    // Clicking a starter template creates note with template markdown
    onQuickCreate.mockClear();
    const templateBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.start-template-chip'))
      .find(b => b.textContent?.includes('Lista de tarefas'))!;
    act(() => templateBtn.click());
    expect(onQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Lista de tarefas',
      focus: 'body',
      content: expect.stringContaining('- [ ]'),
    }));
  });

  it('mantém destaque para primeira nota na primeira visita ao demo mesmo com exemplos', () => {
    const onQuickCreate = vi.fn();
    const demoNotes = [
      makeNote('1', 'Seu espaço para pensar'),
      makeNote('2', 'Meu segundo cérebro'),
    ];

    act(() => {
      root.render(createElement(StartPage, {
        notes: demoNotes,
        isDemo: true,
        hasCreatedNote: false,
        onCreate: vi.fn(),
        onQuickCreate,
        onSearch: vi.fn(),
        onGraph: vi.fn(),
        onLibrary: vi.fn(),
        onDaily: vi.fn(),
        onOpen: vi.fn(),
        formatDate: () => '20 nov',
      }));
    });

    expect(container.querySelector('#start-title')?.textContent).toBe('Crie sua primeira nota');
    expect(container.querySelector('.start-eyebrow')?.textContent).toContain('DEMONSTRAÇÃO');
    expect(container.querySelector('.start-demo-badge')?.textContent).toBe('Exemplos');
    expect(container.querySelectorAll('.start-recent')).toHaveLength(2);
  });

  it('exibe cabeçalho de retorno com botão principal Nova nota após a primeira nota ser criada', () => {
    const onCreate = vi.fn();
    const userNotes = [makeNote('u1', 'Minha primeira nota')];

    act(() => {
      root.render(createElement(StartPage, {
        notes: userNotes,
        isDemo: true,
        hasCreatedNote: true,
        onCreate,
        onQuickCreate: vi.fn(),
        onSearch: vi.fn(),
        onGraph: vi.fn(),
        onLibrary: vi.fn(),
        onDaily: vi.fn(),
        onOpen: vi.fn(),
        formatDate: () => '20 nov',
      }));
    });

    expect(container.querySelector('#start-title')?.textContent).toBe('O que vamos fazer hoje?');
    expect(container.querySelector('.start-composer')).toBeNull();
    expect(container.querySelector('.start-demo-badge')).toBeNull();
    const primaryBtn = container.querySelector<HTMLButtonElement>('.start-header .primary')!;
    expect(primaryBtn.textContent).toContain('Nova nota');
    act(() => primaryBtn.click());
    expect(onCreate).toHaveBeenCalledWith('note');
  });
});
