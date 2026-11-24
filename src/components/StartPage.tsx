import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Network,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Star,
  Table2,
} from 'lucide-react';
import type { Note } from '../lib/vault';

export interface QuickCreateOptions {
  title: string;
  content?: string;
  focus?: 'title' | 'body';
}

const STARTER_TEMPLATES = [
  {
    title: 'Ideia rápida',
    content: '# Ideia rápida\n\nO que quero registrar agora:\n\n- \n\n#ideias',
  },
  {
    title: 'Lista de tarefas',
    content: '# Lista de tarefas\n\n- [ ] Primeira tarefa\n- [ ] Segunda tarefa\n- [ ] \n\n#tarefas',
  },
  {
    title: 'Resumo de estudo',
    content: '# Resumo de estudo\n\n## Pontos principais\n\n- \n\n## Dúvidas para revisar\n\n- \n\n#estudos',
  },
] as const;

export default function StartPage({
  notes,
  connectionCount = 0,
  onCreate,
  onQuickCreate,
  onSearch,
  onGraph,
  onLibrary,
  onDaily,
  onOpen,
  formatDate,
  isDemo = false,
  hasCreatedNote,
}: {
  notes: Note[];
  connectionCount?: number;
  onCreate: (kind: 'note' | 'sheet') => void;
  onQuickCreate?: (options: QuickCreateOptions) => void;
  onSearch: () => void;
  onGraph: () => void;
  onLibrary: () => void;
  onDaily: () => void;
  onOpen: (id: string) => void;
  formatDate: (date: string) => string;
  isDemo?: boolean;
  hasCreatedNote?: boolean;
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const recent = [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const resolvedHasCreated = hasCreatedNote ?? (!isDemo && notes.length > 0);
  const isEmpty = notes.length === 0;
  const isFirstNote = isEmpty || !resolvedHasCreated;
  const showExampleBadge = isDemo && !resolvedHasCreated && recent.length > 0;
  const sheetCount = notes.filter(n => n.kind === 'sheet').length;
  const noteCount = notes.length - sheetCount;

  function nextDefaultTitle() {
    const existing = new Set(notes.map(n => n.title.trim().toLocaleLowerCase()));
    return existing.has('minha primeira nota') ? 'Nova nota' : 'Minha primeira nota';
  }

  function handleQuickSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draftTitle.trim();
    if (onQuickCreate) {
      onQuickCreate({
        title: trimmed || nextDefaultTitle(),
        focus: trimmed ? 'body' : 'title',
      });
      setDraftTitle('');
      return;
    }
    onCreate('note');
  }

  function handleTemplateClick(template: (typeof STARTER_TEMPLATES)[number]) {
    if (onQuickCreate) {
      onQuickCreate({
        title: template.title,
        content: template.content,
        focus: 'body',
      });
      return;
    }
    onCreate('note');
  }

  const actions = [
    {
      title: 'Escrever uma nota',
      detail: 'Registre uma ideia, resumo ou lista.',
      icon: FileText,
      action: () => onCreate('note'),
      tone: 'peach',
      featured: true,
    },
    {
      title: 'Criar planilha',
      detail: 'Organize valores e faça cálculos.',
      icon: Table2,
      action: () => onCreate('sheet'),
      tone: 'blue',
      featured: false,
    },
    {
      title: 'Buscar documentos',
      detail: 'Encontre notas pelo título ou texto.',
      icon: Search,
      action: onSearch,
      tone: 'sand',
      featured: false,
    },
    {
      title: 'Explorar conexões',
      detail: 'Veja quais notas se referenciam.',
      icon: Network,
      action: onGraph,
      tone: 'lilac',
      featured: false,
    },
  ];

  return (
    <section className="start-page" aria-labelledby="start-title">
      <motion.div
        className="start-inner"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {isFirstNote ? (
          <header className="start-header start-header-first">
            <div className="start-header-top">
              <div className="start-header-copy">
                <span className="eyebrow start-eyebrow">
                  <Sparkles size={13} aria-hidden="true" />
                  {isDemo ? 'PRIMEIRA VISITA · DEMONSTRAÇÃO' : 'COMECE POR AQUI'}
                </span>
                <h1 id="start-title">Crie sua primeira nota</h1>
                <p>
                  {isEmpty
                    ? 'Digite um título abaixo ou escolha um modelo. A nota abre direto no editor.'
                    : 'A demonstração traz exemplos para explorar, mas você já pode criar sua primeira nota agora.'}
                </p>
              </div>
              {notes.length > 0 && (
                <div className="start-stats" aria-label="Resumo do espaço">
                  <span><strong>{noteCount}</strong> {noteCount === 1 ? 'nota' : 'notas'}</span>
                  <span><strong>{sheetCount}</strong> {sheetCount === 1 ? 'planilha' : 'planilhas'}</span>
                  <span><strong>{connectionCount}</strong> {connectionCount === 1 ? 'conexão' : 'conexões'}</span>
                </div>
              )}
            </div>

            <form className="start-composer" onSubmit={handleQuickSubmit}>
              <label className="sr-only" htmlFor="start-first-note-title">Título da primeira nota</label>
              <input
                id="start-first-note-title"
                type="text"
                maxLength={500}
                placeholder="Ex.: Ideias para hoje, resumo ou lista…"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
              />
              <button type="submit" className="primary start-composer-submit">
                <PenLine size={17} aria-hidden="true" /> Criar primeira nota
              </button>
            </form>

            <div className="start-templates" aria-label="Modelos rápidos para começar">
              <span className="start-templates-label">Ou comece com um modelo:</span>
              <div className="start-template-list">
                {STARTER_TEMPLATES.map(template => (
                  <button
                    key={template.title}
                    type="button"
                    className="start-template-chip"
                    onClick={() => handleTemplateClick(template)}
                  >
                    <Plus size={13} aria-hidden="true" /> {template.title}
                  </button>
                ))}
              </div>
              <button type="button" className="secondary start-daily-btn" onClick={onDaily}>
                <CalendarDays size={16} aria-hidden="true" /> Nota do dia
              </button>
            </div>
          </header>
        ) : (
          <header className="start-header">
            <div className="start-header-copy">
              <h1 id="start-title">O que vamos fazer hoje?</h1>
              <p>Crie uma nova nota ou retome um documento recente.</p>
              {notes.length > 0 && (
                <div className="start-stats start-stats-inline" aria-label="Resumo do espaço">
                  <span><strong>{noteCount}</strong> {noteCount === 1 ? 'nota' : 'notas'}</span>
                  <span><strong>{sheetCount}</strong> {sheetCount === 1 ? 'planilha' : 'planilhas'}</span>
                  <span><strong>{connectionCount}</strong> {connectionCount === 1 ? 'conexão' : 'conexões'}</span>
                </div>
              )}
            </div>
            <div className="start-header-actions">
              <button type="button" className="primary" onClick={() => onCreate('note')}>
                <Plus size={17} aria-hidden="true" /> Nova nota
              </button>
              <button type="button" className="secondary" onClick={onDaily}>
                <CalendarDays size={17} aria-hidden="true" /> Nota do dia
              </button>
            </div>
          </header>
        )}

        <div className="start-actions" aria-label="Ações rápidas">
          {actions.map(({ title, detail, icon: Icon, action, tone, featured }) => (
            <button
              key={title}
              type="button"
              className="start-action"
              data-tone={tone}
              data-featured={featured ? 'true' : undefined}
              onClick={action}
            >
              <span className="start-action-icon"><Icon size={21} aria-hidden="true" /></span>
              <strong>{title}</strong>
              <span>{detail}</span>
              <ArrowRight className="start-arrow" size={17} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="start-lower">
          <section className="start-panel" aria-labelledby="recent-title">
            <div className="start-panel-heading">
              <div className="start-panel-title">
                <h2 id="recent-title">Recentes</h2>
                {showExampleBadge && <span className="start-demo-badge">Exemplos</span>}
              </div>
              <button type="button" onClick={onLibrary}>
                Ver biblioteca <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
            {recent.length ? recent.map(note => (
              <button key={note.id} type="button" className="start-recent" onClick={() => onOpen(note.id)}>
                {note.kind === 'sheet' ? <Table2 size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
                <span>{note.title || 'Sem título'}</span>
                {note.favorite && <Star size={12} className="start-recent-star" aria-label="Favorita" />}
                <small>{formatDate(note.updated_at)}</small>
              </button>
            )) : (
              <div className="start-empty">
                <p>Os documentos que você criar aparecem aqui.</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onQuickCreate ? onQuickCreate({ title: nextDefaultTitle(), focus: 'title' }) : onCreate('note')}
                >
                  <Plus size={15} aria-hidden="true" /> Criar primeira nota
                </button>
              </div>
            )}
          </section>
          <section className="start-panel start-guide" aria-labelledby="guide-title">
            <h2 id="guide-title">Como usar o Nexo</h2>
            <details>
              <summary>Como conecto duas notas?</summary>
              <p>Na edição, digite <code>[[Título da nota]]</code>. Abra <strong>Conexões</strong> para ver o link no mapa.</p>
            </details>
            <details>
              <summary>Como uso a busca rápida?</summary>
              <p>Pressione <code>⌘K</code> (ou <code>Ctrl+K</code>) em qualquer tela para abrir notas, pastas ou ações sem sair do que está fazendo.</p>
            </details>
            <details>
              <summary>Como faço um cálculo?</summary>
              <p>Na planilha, toque em uma célula e digite <code>=SOMA(A1:A5)</code> na barra de fórmula. Na nota, abra <strong>Calculadora</strong>.</p>
            </details>
            <details>
              <summary>Como organizo minhas notas?</summary>
              <p>Crie uma pasta pelo menu ou use <code>#tema</code> no texto. Abra <strong>Biblioteca</strong> para filtrar seus documentos.</p>
            </details>
          </section>
        </div>
      </motion.div>
    </section>
  );
}
