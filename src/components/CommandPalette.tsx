import { useEffect } from 'react';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarDays,
  FileText,
  Folder,
  Hash,
  House,
  Moon,
  Network,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Table2,
  X,
} from 'lucide-react';
import type { Note } from '../lib/vault';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  folders: string[];
  tags: string[];
  dark: boolean;
  onOpenNote: (id: string) => void;
  onCreate: (kind: 'note' | 'sheet') => void;
  onDaily: () => void;
  onGoHome: () => void;
  onGoGraph: () => void;
  onGoSettings: () => void;
  onFilterFolder: (folder: string) => void;
  onFilterTag: (tag: string) => void;
  onToggleTheme: () => void;
}

export default function CommandPalette({
  open,
  onOpenChange,
  notes,
  folders,
  tags,
  dark,
  onOpenNote,
  onCreate,
  onDaily,
  onGoHome,
  onGoGraph,
  onGoSettings,
  onFilterFolder,
  onFilterTag,
  onToggleTheme,
}: CommandPaletteProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const sortedNotes = [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={e => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            className="cmdk-shell"
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos e busca rápida"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <Command label="Buscar ou executar comando">
              <div className="cmdk-input-row">
                <Search size={17} aria-hidden="true" />
                <Command.Input
                  autoFocus
                  placeholder="Buscar notas, planilhas, pastas ou ações…"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fechar busca rápida"
                  onClick={() => onOpenChange(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <Command.List className="cmdk-list">
                <Command.Empty className="cmdk-empty">
                  Nenhum documento ou comando encontrado.
                </Command.Empty>

                <Command.Group heading="Ações rápidas">
                  <Command.Item value="Nova nota criar documento" onSelect={() => run(() => onCreate('note'))}>
                    <Plus size={15} />
                    <span>Nova nota</span>
                    <kbd>⌘N</kbd>
                  </Command.Item>
                  <Command.Item value="Nova planilha tabela calculo" onSelect={() => run(() => onCreate('sheet'))}>
                    <Table2 size={15} />
                    <span>Nova planilha</span>
                  </Command.Item>
                  <Command.Item value="Nota do dia diario hoje" onSelect={() => run(onDaily)}>
                    <CalendarDays size={15} />
                    <span>Abrir nota do dia</span>
                  </Command.Item>
                  <Command.Item value="Conexoes grafo mapa ideias" onSelect={() => run(onGoGraph)}>
                    <Network size={15} />
                    <span>Explorar conexões</span>
                  </Command.Item>
                  <Command.Item value="Inicio home painel" onSelect={() => run(onGoHome)}>
                    <House size={15} />
                    <span>Ir para Início</span>
                  </Command.Item>
                  <Command.Item value="Alternar tema escuro claro aparencia" onSelect={() => run(onToggleTheme)}>
                    {dark ? <Sun size={15} /> : <Moon size={15} />}
                    <span>{dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}</span>
                  </Command.Item>
                  <Command.Item value="Configuracoes backup importar conta" onSelect={() => run(onGoSettings)}>
                    <Settings size={15} />
                    <span>Configurações e backup</span>
                  </Command.Item>
                </Command.Group>

                {sortedNotes.length > 0 && (
                  <Command.Group heading="Documentos">
                    {sortedNotes.slice(0, 24).map(note => (
                      <Command.Item
                        key={note.id}
                        value={`${note.title || 'Sem título'} ${note.folder} ${note.tags.join(' ')} ${note.kind === 'sheet' ? 'planilha' : note.content.slice(0, 120)}`}
                        onSelect={() => run(() => onOpenNote(note.id))}
                      >
                        {note.kind === 'sheet' ? <Table2 size={15} /> : <FileText size={15} />}
                        <span className="cmdk-item-title">{note.title || 'Sem título'}</span>
                        {note.favorite && <Star size={12} className="cmdk-star" />}
                        {note.folder && <span className="cmdk-pill">{note.folder}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {folders.length > 0 && (
                  <Command.Group heading="Pastas">
                    {folders.map(folder => (
                      <Command.Item
                        key={folder}
                        value={`pasta ${folder}`}
                        onSelect={() => run(() => onFilterFolder(folder))}
                      >
                        <Folder size={15} />
                        <span>{folder}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {tags.length > 0 && (
                  <Command.Group heading="Tags">
                    {tags.map(tag => (
                      <Command.Item
                        key={tag}
                        value={`tag #${tag}`}
                        onSelect={() => run(() => onFilterTag(tag))}
                      >
                        <Hash size={15} />
                        <span>#{tag}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="cmdk-footer" aria-hidden="true">
                <span><kbd>↑↓</kbd> navegar</span>
                <span><kbd>↵</kbd> abrir</span>
                <span><kbd>esc</kbd> fechar</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
