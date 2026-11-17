import { ArrowRight, CalendarDays, FileText, Network, Search, Table2 } from 'lucide-react';
import type { Note } from '../lib/vault';

export default function StartPage({ notes, onCreate, onSearch, onGraph, onLibrary, onDaily, onOpen, formatDate }: {
  notes: Note[];
  onCreate: (kind: 'note' | 'sheet') => void;
  onSearch: () => void;
  onGraph: () => void;
  onLibrary: () => void;
  onDaily: () => void;
  onOpen: (id: string) => void;
  formatDate: (date: string) => string;
}) {
  const recent = [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const actions = [
    { title: 'Escrever uma nota', detail: 'Registre uma ideia, resumo ou lista.', icon: FileText, action: () => onCreate('note'), tone: 'peach' },
    { title: 'Criar planilha', detail: 'Organize valores e faça cálculos.', icon: Table2, action: () => onCreate('sheet'), tone: 'blue' },
    { title: 'Buscar documentos', detail: 'Encontre notas pelo título ou texto.', icon: Search, action: onSearch, tone: 'sand' },
    { title: 'Explorar conexões', detail: 'Veja quais notas se referenciam.', icon: Network, action: onGraph, tone: 'lilac' },
  ];

  return (
    <section className="start-page" aria-labelledby="start-title">
      <div className="start-inner">
        <header className="start-header">
          <div>
            <h1 id="start-title">O que vamos fazer hoje?</h1>
            <p>Escolha uma tarefa ou retome um documento recente.</p>
          </div>
          <button type="button" className="secondary" onClick={onDaily}><CalendarDays size={17} /> Nota do dia</button>
        </header>
        <div className="start-actions" aria-label="Ações rápidas">
          {actions.map(({ title, detail, icon: Icon, action, tone }) => (
            <button key={title} type="button" className="start-action" data-tone={tone} onClick={action}>
              <span className="start-action-icon"><Icon size={21} /></span>
              <strong>{title}</strong>
              <span>{detail}</span>
              <ArrowRight className="start-arrow" size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="start-lower">
          <section className="start-panel" aria-labelledby="recent-title">
            <div className="start-panel-heading">
              <h2 id="recent-title">Recentes</h2>
              <button type="button" onClick={onLibrary}>Ver biblioteca <ArrowRight size={14} /></button>
            </div>
            {recent.length ? recent.map(note => (
              <button key={note.id} type="button" className="start-recent" onClick={() => onOpen(note.id)}>
                {note.kind === 'sheet' ? <Table2 size={17} /> : <FileText size={17} />}
                <span>{note.title || 'Sem título'}</span>
                <small>{formatDate(note.updated_at)}</small>
              </button>
            )) : <p>Os documentos que você criar aparecem aqui.</p>}
          </section>
          <section className="start-panel start-guide" aria-labelledby="guide-title">
            <h2 id="guide-title">Como usar o Nexo</h2>
            <details><summary>Como conecto duas notas?</summary><p>Na edição, digite <code>[[Título da nota]]</code>. Abra <strong>Conexões</strong> para ver o link no mapa.</p></details>
            <details><summary>Como faço um cálculo?</summary><p>Na planilha, toque em uma célula e digite <code>=SOMA(A1:A5)</code> na barra de fórmula. Na nota, abra <strong>Calculadora</strong>.</p></details>
            <details><summary>Como organizo minhas notas?</summary><p>Crie uma pasta pelo menu ou use <code>#tema</code> no texto. Abra <strong>Biblioteca</strong> para buscar seus documentos.</p></details>
          </section>
        </div>
      </div>
    </section>
  );
}
