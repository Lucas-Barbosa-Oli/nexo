import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import { MotionConfig } from 'motion/react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowUpDown,
  ArrowUpRight,
  BookOpen,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
  Cloud,
  CloudOff,
  Code2,
  Columns2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Hash,
  House,
  Laptop,
  Link2,
  List,
  ListOrdered,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  Moon,
  Network,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Plus,
  Quote,
  Search,
  Settings,
  Star,
  Sun,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import StartPage, { type QuickCreateOptions } from './components/StartPage';
import Graph from './components/Graph';
import { Brand } from './components/BrandMark';
import CommandPalette from './components/CommandPalette';
import AuthShowcase from './components/AuthShowcase';
import { supabase } from './integrations/supabase/client';
import { Vault, type Note } from './lib/vault';
import { createCloudBackend } from './lib/cloud-backend';
import { buildLinkIndex, normTitle } from './lib/links';
import { calculate, formatNumber } from './lib/formula';
import { renderMarkdown } from './lib/markdown';
import {
  colName,
  computeSheet,
  displayCell,
  emptySheet,
  parseSheet,
  refName,
  sheetToCsv,
} from './lib/sheet';

function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toLocaleDateString('sv-SE');
const date = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

function IconButton({
  label,
  onClick,
  children,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={'icon-button ' + (active ? 'active' : '')}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('nexo:theme') === 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('nexo:theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Toaster
        position="bottom-center"
        theme={dark ? 'dark' : 'light'}
        toastOptions={{
          className: 'nexo-toast',
        }}
      />
      {loading ? (
        <div className="loading">
          <Brand size="lg" />
          <p className="muted">Abrindo seu espaço…</p>
        </div>
      ) : recovery && session ? (
        <PasswordReset done={() => setRecovery(false)} />
      ) : !session && !demo ? (
        <Auth dark={dark} onToggleTheme={() => setDark(d => !d)} onDemo={() => setDemo(true)} />
      ) : (
        <Workspace
          key={session?.user.id ?? 'demo'}
          scope={session?.user.id ?? 'demo'}
          email={session?.user.email}
          dark={dark}
          onToggleTheme={() => setDark(d => !d)}
          onExit={async () => {
            if (session) await supabase.auth.signOut();
            setDemo(false);
          }}
        />
      )}
    </MotionConfig>
  );
}

function PasswordReset({ done }: { done: () => void }) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <div className="auth-page auth-page-single">
      <form
        className="auth-card"
        onSubmit={async e => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password });
          if (error) setMsg(error.message);
          else done();
        }}
      >
        <Brand size="md" />
        <h2 style={{ marginTop: 22 }}>Uma nova senha</h2>
        <p>Escolha uma senha com pelo menos 8 caracteres para voltar ao seu espaço.</p>
        <label>
          Nova senha
          <div className="password-field">
            <input
              type={showPass ? 'text' : 'password'}
              minLength={8}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setShowPass(v => !v)}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <button className="primary wide">Salvar senha</button>
        <p className="form-message" role="status">{msg}</p>
      </form>
    </div>
  );
}

function Auth({
  dark,
  onToggleTheme,
  onDemo,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  onDemo: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
        if (error) throw error;
        setMsg('Se existir uma conta, você receberá as instruções por e-mail.');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin },
        });
        if (error) throw error;
        if (!data.session) setMsg('Confira seu e-mail para confirmar o cadastro. Depois, entre aqui.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-theme-bar">
        <IconButton label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={onToggleTheme}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      </div>

      <div className="auth-story">
        <Brand size="lg" />
        <h1>
          Seu caderno,
          <br />
          em qualquer lugar.
        </h1>
        <p>Escreva notas, conecte ideias e mantenha seus documentos sincronizados em um espaço tranquilo.</p>
        <AuthShowcase />
      </div>

      <form className="auth-card" onSubmit={submit}>
        {mode !== 'reset' && (
          <div className="auth-tabs" role="tablist" aria-label="Modo de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setMsg('');
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setMsg('');
              }}
            >
              Criar conta
            </button>
          </div>
        )}

        <h2>{mode === 'signup' ? 'Comece seu Nexo' : mode === 'reset' ? 'Recupere o acesso' : 'Entrar no Nexo'}</h2>
        <p>
          {mode === 'signup'
            ? 'Crie uma conta para sincronizar suas ideias entre dispositivos.'
            : mode === 'reset'
              ? 'Informe seu e-mail para receber um link de recuperação.'
              : 'Entre para continuar exatamente de onde parou.'}
        </p>

        <label>
          E-mail
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </label>

        {mode !== 'reset' && (
          <label>
            Senha
            <div className="password-field">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={8}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPass(v => !v)}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        )}

        <button className="primary" disabled={busy}>
          {busy
            ? 'Aguarde…'
            : mode === 'signup'
              ? 'Criar minha conta'
              : mode === 'reset'
                ? 'Enviar instruções'
                : 'Entrar no meu espaço'}
          <ArrowUpRight size={17} />
        </button>

        <p className="form-message" role="status">
          {msg}
        </p>

        <div className="auth-links">
          {mode === 'reset' ? (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMsg('');
              }}
            >
              ← Voltar para entrar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setMsg('');
              }}
            >
              Esqueci minha senha
            </button>
          )}
        </div>

        <div className="separator">ou conheça primeiro</div>
        <button type="button" className="secondary wide" onClick={onDemo}>
          Explorar demonstração <ChevronRight size={16} />
        </button>
        <p className="fine">Na demonstração, as notas ficam somente neste navegador.</p>
      </form>
    </div>
  );
}

function seed(v: Vault) {
  v.addFolder('Comece por aqui');
  v.addFolder('Pessoal');
  v.addFolder('Projetos');
  v.createNote({
    title: 'Seu espaço para pensar',
    folder: 'Comece por aqui',
    favorite: true,
    content:
      '# Toda grande ideia começa com uma anotação.\n\nBem-vindo ao **Nexo**, um lugar tranquilo para organizar o que importa e descobrir conexões pelo caminho.\n\n## Um pensamento de cada vez\n\nCapture uma ideia, registre algo que aprendeu ou simplesmente escreva. Suas notas não precisam estar prontas para serem valiosas.\n\n> “O que você sabe ganha valor quando se conecta ao que está aprendendo.”\n\n## Faça suas primeiras conexões\n\n- Explore [[Meu segundo cérebro]] para organizar seu espaço.\n- Abra [[Ideias para explorar]] e acrescente uma curiosidade.\n- Veja [[Planejamento mensal]] para experimentar uma planilha.\n\n## Matemática, sem sair da nota\n\nEscreva fórmulas entre cifrões: $E = mc^2$. Para calcular, abra a **Calculadora** na barra do editor.\n\n$$\n\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$\n\n#começar #conhecimento',
  });
  v.createNote({
    title: 'Meu segundo cérebro',
    folder: 'Comece por aqui',
    content:
      '# Um sistema que cresce com você\n\nUse pastas para contextos e **#tags** para temas. Conecte notas escrevendo `[[Nome da nota]]`.\n\n## Três hábitos simples\n\n- [ ] Capturar uma ideia por dia\n- [ ] Revisitar notas da semana\n- [ ] Conectar o que faz sentido\n\nVolte para [[Seu espaço para pensar]] ou explore [[Ideias para explorar]].\n\n#conhecimento #organização',
  });
  v.createNote({
    title: 'Ideias para explorar',
    folder: 'Pessoal',
    content:
      '# Deixe espaço para a curiosidade\n\n- O que aprendi esta semana?\n- Que problema quero resolver?\n- Que ideias podem se conectar?\n\nLeia [[Meu segundo cérebro]] e transforme uma ideia em um projeto.\n\n#ideias',
  });
  v.createNote({
    title: 'Planejamento mensal',
    kind: 'sheet',
    folder: 'Pessoal',
    content: JSON.stringify({
      rows: 20,
      cols: 6,
      cells: {
        A1: 'Categoria',
        B1: 'Planejado',
        C1: 'Realizado',
        D1: 'Diferença',
        A2: 'Moradia',
        B2: '1500',
        C2: '1450',
        D2: '=B2-C2',
        A3: 'Alimentação',
        B3: '600',
        C3: '580',
        D3: '=B3-C3',
        A4: 'Estudos',
        B4: '200',
        C4: '150',
        D4: '=B4-C4',
        A6: 'Total',
        B6: '=SOMA(B2:B4)',
        C6: '=SOMA(C2:C4)',
        D6: '=SOMA(D2:D4)',
      },
    }),
  });
}

function Workspace({
  scope,
  email,
  dark,
  onToggleTheme,
  onExit,
}: {
  scope: string;
  email?: string;
  dark: boolean;
  onToggleTheme: () => void;
  onExit: () => Promise<void>;
}) {
  const [vault] = useState(() => new Vault(scope, scope === 'demo' ? null : createCloudBackend(scope), localStorage));
  const state = useSyncExternalStore(vault.subscribe, vault.getSnapshot);
  const [selected, setSelected] = useState<string | null>(localStorage.getItem('nexo:selected:' + scope));
  const [view, setView] = useState('home');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [right, setRight] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [editing, setEditing] = useState<'write' | 'read' | 'split'>('read');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<'note' | 'sheet'>('note');
  const [showFolder, setShowFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [install, setInstall] = useState<any>(null);
  const [update, setUpdate] = useState(false);
  const [hasCreatedNote, setHasCreatedNote] = useState(() => localStorage.getItem('nexo:created:' + scope) === '1');
  const [pendingFocus, setPendingFocus] = useState<{ id: string; target: 'title' | 'body' } | null>(null);

  const importRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const all = useMemo(() => Object.values(state.notes), [state.notes]);
  const live = useMemo(() => all.filter(n => !n.deleted_at), [all]);
  const note = selected ? state.notes[selected] : null;
  const links = useMemo(() => buildLinkIndex(all), [state.notes]);
  const tags = useMemo(() => [...new Set(live.flatMap(n => n.tags))].sort(), [live]);
  const folders = useMemo(
    () => [...new Set([...state.folders, ...live.map(n => n.folder).filter(Boolean)])].sort(),
    [state.folders, live],
  );
  const totalConnections = useMemo(() => {
    let count = 0;
    const seen = new Set<string>();
    for (const n of live) {
      for (const target of links.outgoing.get(n.id) ?? []) {
        if (!state.notes[target] || state.notes[target].deleted_at) continue;
        const pair = [n.id, target].sort().join(':');
        if (!seen.has(pair)) {
          seen.add(pair);
          count++;
        }
      }
    }
    return count;
  }, [live, links, state.notes]);

  const notify = (s: string) => sonnerToast(s);

  useEffect(() => {
    if (selected) localStorage.setItem('nexo:selected:' + scope, selected);
  }, [selected, scope]);

  useEffect(() => {
    if (scope === 'demo' && !Object.keys(vault.state.notes).length) seed(vault);
    void vault.sync();
    const t = setInterval(() => void vault.sync(), 12000);
    const refresh = () => void vault.sync();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [vault, scope]);

  useEffect(() => {
    if (state.queue.length && !state.conflicts.length) {
      const t = setTimeout(() => void vault.flush(), 800);
      return () => clearTimeout(t);
    }
  }, [state.queue, vault, state.conflicts.length]);

  useEffect(() => {
    if (!selected && live.length) setSelected(live[0].id);
  }, [live.length, selected]);

  useEffect(() => {
    const fn = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    const upd = () => setUpdate(true);
    window.addEventListener('beforeinstallprompt', fn);
    window.addEventListener('nexo-update', upd);
    return () => {
      window.removeEventListener('beforeinstallprompt', fn);
      window.removeEventListener('nexo-update', upd);
    };
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
        setMenu(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowNew(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && view === 'notes' && note?.kind === 'note' && !note.deleted_at) {
        e.preventDefault();
        setEditing(cur => (cur === 'read' ? 'write' : 'read'));
      } else if (e.key === 'Escape' && focusMode && !paletteOpen && !showNew && !showFolder) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [view, note, focusMode, paletteOpen, showNew, showFolder]);

  function markNoteCreated() {
    setHasCreatedNote(true);
    localStorage.setItem('nexo:created:' + scope, '1');
  }

  function open(id: string) {
    setSelected(id);
    setEditing('read');
    setView('notes');
    setMenu(false);
  }

  function goHome() {
    setFocusMode(false);
    setView('home');
    setMenu(false);
  }

  function browseDocuments(nextFilter = 'all', nextView = 'library') {
    setFocusMode(false);
    setFilter(nextFilter);
    setQuery('');
    setView(nextView);
    setMenu(false);
  }

  function newDocument(kind: 'note' | 'sheet') {
    setNewTitle('');
    setNewKind(kind);
    setShowNew(true);
    setMenu(false);
  }

  function quickCreateNote({ title, content = '', focus = 'body' }: QuickCreateOptions) {
    const first = !hasCreatedNote;
    const n = vault.createNote({ title: title.trim() || 'Minha primeira nota', kind: 'note', folder: '', content });
    markNoteCreated();
    setFilter('all');
    open(n.id);
    setEditing('write');
    setPendingFocus({ id: n.id, target: focus });
    if (first) notify('Primeira nota criada! Já está pronta para escrever.');
  }

  function openWiki(title: string) {
    const id = links.byTitle.get(normTitle(title));
    if (id) open(id);
    else {
      setNewTitle(title);
      setNewKind('note');
      setShowNew(true);
    }
  }

  function daily() {
    const title = today();
    const existing = live.find(n => n.title === title && n.folder === 'Diário');
    const n =
      existing ??
      vault.createNote({
        title,
        folder: 'Diário',
        content: `# ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n## O que está na minha cabeça?\n\n\n## Para hoje\n\n- [ ] \n`,
      });
    if (!existing) markNoteCreated();
    vault.addFolder('Diário');
    open(n.id);
    setEditing('write');
    setPendingFocus({ id: n.id, target: 'body' });
  }

  function create() {
    if (!newTitle.trim()) return;
    const n = vault.createNote({
      title: newTitle.trim(),
      kind: newKind,
      folder: filter.startsWith('folder:') ? filter.slice(7) : '',
      content: newKind === 'sheet' ? JSON.stringify(emptySheet()) : '',
    });
    if (newKind === 'note') markNoteCreated();
    open(n.id);
    setEditing('write');
    if (newKind === 'note') setPendingFocus({ id: n.id, target: 'body' });
    setShowNew(false);
    setNewTitle('');
  }

  function trashWithUndo(target: Note) {
    vault.trash(target.id);
    setSelected(null);
    setFocusMode(false);
    sonnerToast(`“${target.title || 'Sem título'}” movida para a lixeira.`, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          vault.restore(target.id);
          open(target.id);
        },
      },
    });
  }

  useEffect(() => {
    if (pendingFocus && pendingFocus.target === 'title' && note?.id === pendingFocus.id && view === 'notes') {
      requestAnimationFrame(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
        setPendingFocus(null);
      });
    }
  }, [pendingFocus, note?.id, view]);

  const filtered = (view === 'trash' ? all.filter(n => n.deleted_at) : live)
    .filter(
      n =>
        (filter === 'all' ||
          view === 'trash' ||
          view === 'search' ||
          (filter === 'favorites' && n.favorite) ||
          (filter === 'notes' && n.kind === 'note') ||
          (filter === 'sheets' && n.kind === 'sheet') ||
          (filter.startsWith('folder:') && n.folder === filter.slice(7)) ||
          (filter.startsWith('tag:') && n.tags.includes(filter.slice(4)))) &&
        (!query || `${n.title} ${n.content}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
    )
    .sort((a, b) =>
      sortBy === 'alpha'
        ? (a.title || 'Sem título').localeCompare(b.title || 'Sem título', 'pt-BR')
        : b.updated_at.localeCompare(a.updated_at),
    );

  async function importFiles(files: FileList | null) {
    if (!files) return;
    let count = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10000000) throw new Error('O limite por arquivo é 10 MB.');
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          if (data.format !== 'nexo-backup-v1' || !Array.isArray(data.notes) || data.notes.length > 5000)
            throw new Error('Backup inválido.');
          for (const n of data.notes) {
            if (
              typeof n.title !== 'string' ||
              typeof n.content !== 'string' ||
              !['note', 'sheet'].includes(n.kind) ||
              n.content.length > 2000000
            )
              throw new Error('O backup contém uma nota inválida.');
          }
          for (const n of data.notes) {
            vault.createNote({
              title: n.title.slice(0, 500),
              content: n.content,
              kind: n.kind,
              folder: typeof n.folder === 'string' ? n.folder.slice(0, 500) : '',
              favorite: !!n.favorite,
            });
            count++;
          }
        } else {
          vault.createNote({ title: file.name.replace(/\.(md|txt)$/i, ''), content: text });
          count++;
        }
      }
      notify(`${count} documento(s) importado(s), sem substituir notas existentes.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível importar.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  const statusText = {
    demo: 'Somente neste navegador',
    saved: 'Sincronizado',
    pending: 'Salvamento pendente',
    saving: 'Salvando…',
    offline: 'Offline · alterações locais',
    error: 'Falha ao salvar',
    conflict: 'Conflito para resolver',
  }[state.status];

  const isDocView = view === 'notes' || view === 'trash-detail';
  const showRightPanel = isDocView && right && !focusMode;

  const nav = (id: string, label: string, icon: ReactNode, action: () => void, badge?: number) => (
    <button
      type="button"
      className={'nav-item ' + (view === id || (view === 'library' && filter === id) ? 'selected' : '')}
      onClick={action}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && <small>{badge}</small>}
    </button>
  );

  const wordCount = note && note.kind === 'note' && note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  return (
    <div
      className={
        'workspace ' +
        (collapsed || focusMode ? 'collapsed ' : '') +
        (focusMode ? 'focus-mode ' : '') +
        (menu ? 'menu-open' : '')
      }
    >
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand size="sm" />
          <IconButton
            label="Recolher navegação"
            onClick={() => {
              setCollapsed(!collapsed);
              setMenu(false);
            }}
          >
            <PanelLeftClose size={17} />
          </IconButton>
        </div>

        <button
          type="button"
          className="quick-search"
          onClick={() => {
            setPaletteOpen(true);
            setMenu(false);
          }}
        >
          <Search size={15} />
          <span>Busca rápida…</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          type="button"
          className="primary new-note"
          onClick={() => {
            setNewKind('note');
            setNewTitle('');
            setShowNew(true);
          }}
        >
          <Plus size={17} /> Nova nota
        </button>

        <div className="sidebar-scroll">
          <div className="nav-group">
            {nav('home', 'Início', <House size={17} />, goHome)}
            {nav('all', 'Biblioteca', <FileText size={17} />, () => browseDocuments(), live.length)}
            {nav('favorites', 'Favoritas', <Star size={17} />, () => browseDocuments('favorites'))}
            {nav('daily', 'Nota do dia', <CalendarDays size={17} />, daily)}
            {nav('graph', 'Conexões', <Network size={17} />, () => {
              setFocusMode(false);
              setView('graph');
              setMenu(false);
            })}
            {nav('sheets', 'Planilhas', <Table2 size={17} />, () => browseDocuments('sheets'))}
          </div>

          <div className="section-label">
            <span>PASTAS</span>
            <IconButton label="Criar pasta" onClick={() => setShowFolder(true)}>
              <Plus size={14} />
            </IconButton>
          </div>
          <div className="folder-list">
            {folders.map(f => (
              <button
                type="button"
                key={f}
                className={'nav-item ' + (view === 'library' && filter === 'folder:' + f ? 'selected' : '')}
                onClick={() => browseDocuments('folder:' + f)}
              >
                <Folder size={16} />
                <span>{f}</span>
                <small>{live.filter(n => n.folder === f).length}</small>
              </button>
            ))}
            {!folders.length && <p className="sidebar-hint">Organize seu próximo projeto.</p>}
          </div>

          <div className="section-label">
            <span>TAGS</span>
            <Hash size={13} />
          </div>
          <div className="tags">
            {tags.map(t => (
              <button
                type="button"
                key={t}
                className={view === 'library' && filter === 'tag:' + t ? 'chosen' : ''}
                onClick={() => browseDocuments('tag:' + t)}
              >
                #{t}
              </button>
            ))}
            {!tags.length && <span className="fine">Escreva #tema em uma nota.</span>}
          </div>
        </div>

        <div className="sidebar-bottom">
          {nav('trash', 'Lixeira', <Trash2 size={16} />, () => {
            setFocusMode(false);
            setView('trash');
            setQuery('');
            setMenu(false);
          })}
          {nav('settings', 'Configurações', <Settings size={16} />, () => {
            setFocusMode(false);
            setView('settings');
            setMenu(false);
          })}
          <div className="account">
            <div className="avatar">{email?.[0].toUpperCase() ?? 'N'}</div>
            <div>
              <strong>{scope === 'demo' ? 'Demonstração' : 'Meu espaço'}</strong>
              <small>{email ?? 'Explore com tranquilidade'}</small>
            </div>
          </div>
        </div>
      </aside>

      {menu && <button type="button" className="menu-overlay" aria-label="Fechar menu" onClick={() => setMenu(false)} />}

      <main className="main" data-view={view}>
        {!focusMode && (
          <header className="topbar">
            <div className="breadcrumb">
              <IconButton
                label="Abrir navegação"
                onClick={() => {
                  setMenu(!menu);
                  setCollapsed(false);
                }}
              >
                <Menu size={19} />
              </IconButton>
              <span>Meu espaço</span>
              <ChevronRight className="breadcrumb-separator" size={13} />
              <strong>
                {view === 'home'
                  ? 'Início'
                  : view === 'library'
                    ? 'Biblioteca'
                    : view === 'graph'
                      ? 'Conexões'
                      : view === 'settings'
                        ? 'Configurações'
                        : view === 'trash'
                          ? 'Lixeira'
                          : view === 'search'
                            ? 'Busca'
                            : note?.folder || 'Notas'}
              </strong>
            </div>

            <div className="top-actions">
              <button
                type="button"
                className={'sync ' + (state.status === 'error' || state.status === 'conflict' ? 'warning' : '')}
                title={state.lastError || statusText}
                onClick={() => void vault.sync()}
              >
                {state.status === 'demo' ? (
                  <Laptop size={14} />
                ) : state.status === 'offline' ? (
                  <CloudOff size={14} />
                ) : (
                  <Cloud size={14} />
                )}
                <span>{statusText}</span>
              </button>
              <IconButton label={dark ? 'Tema claro' : 'Tema escuro'} onClick={onToggleTheme}>
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </IconButton>
              {isDocView && (
                <IconButton
                  label={right ? 'Ocultar painel de conexões' : 'Mostrar painel de conexões'}
                  onClick={() => setRight(!right)}
                  active={right}
                >
                  {right ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                </IconButton>
              )}
            </div>
          </header>
        )}

        {scope === 'demo' && !focusMode && (
          <div className="demo-banner">
            Você está explorando uma demonstração.{' '}
            <button type="button" onClick={() => void onExit()}>
              Entre para sincronizar entre dispositivos <ArrowUpRight size={12} />
            </button>
          </div>
        )}

        {update && (
          <div className="demo-banner">
            Uma atualização está disponível. Salve suas alterações e reabra o aplicativo para atualizar.
          </div>
        )}

        {(state.status === 'error' || state.status === 'offline') && (
          <div className="error-banner" role="status">
            {state.lastError || statusText}
            <button type="button" onClick={() => void vault.sync()}>
              Tentar novamente
            </button>
          </div>
        )}

        {state.conflicts.length > 0 && (
          <div className="conflicts">
            <strong>Há edições diferentes em outro dispositivo.</strong>
            {state.conflicts.map(c => (
              <div key={c.id}>
                <span>{c.local.title}</span>
                <button type="button" onClick={() => vault.resolveConflict(c.id, 'both')}>
                  Manter as duas
                </button>
                <button type="button" onClick={() => vault.resolveConflict(c.id, 'server')}>
                  Usar versão cloud
                </button>
                <button type="button" onClick={() => vault.resolveConflict(c.id, 'local')}>
                  Usar minha versão
                </button>
              </div>
            ))}
          </div>
        )}

        {view === 'home' ? (
          <StartPage
            notes={live}
            connectionCount={totalConnections}
            formatDate={date}
            isDemo={scope === 'demo'}
            hasCreatedNote={hasCreatedNote || (scope !== 'demo' && live.length > 0)}
            onCreate={kind => {
              setFilter('all');
              newDocument(kind);
            }}
            onQuickCreate={quickCreateNote}
            onSearch={() => setPaletteOpen(true)}
            onGraph={() => setView('graph')}
            onLibrary={() => browseDocuments()}
            onDaily={daily}
            onOpen={open}
          />
        ) : view === 'settings' ? (
          <section className="settings-page">
            <h1>Configurações</h1>
            <div className="settings-grid">
              <article>
                <Download />
                <h3>Backup completo</h3>
                <p>Exporte notas e planilhas, incluindo a lixeira, em um arquivo JSON.</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    download(
                      'nexo-backup-' + today() + '.json',
                      JSON.stringify(
                        {
                          format: 'nexo-backup-v1',
                          exportedAt: new Date().toISOString(),
                          notes: all,
                          folders: state.folders,
                        },
                        null,
                        2,
                      ),
                      'application/json',
                    )
                  }
                >
                  Exportar backup
                </button>
              </article>
              <article>
                <Upload />
                <h3>Traga suas anotações</h3>
                <p>Importe arquivos Markdown, texto ou um backup Nexo. Os documentos são adicionados como novas notas.</p>
                <button type="button" className="secondary" onClick={() => importRef.current?.click()}>
                  Importar arquivos
                </button>
              </article>
              <article>
                <Laptop />
                <h3>Nexo como aplicativo</h3>
                <p>
                  Instale no navegador do computador ou celular. No iPhone, use Compartilhar → Adicionar à Tela de Início.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    if (install) {
                      await install.prompt();
                      setInstall(null);
                    } else {
                      notify('No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.');
                    }
                  }}
                >
                  Instalar aplicativo
                </button>
              </article>
              <article>
                <Cloud />
                <h3>{scope === 'demo' ? 'Demonstração local' : 'Sua conta'}</h3>
                <p>
                  {email ??
                    'Estas notas estão apenas neste navegador. Exporte um backup para levá-las para sua conta.'}
                </p>
                <p className="fine">
                  {state.lastSynced
                    ? 'Última sincronização: ' + new Date(state.lastSynced).toLocaleString('pt-BR')
                    : statusText}
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    if (state.queue.length || state.conflicts.length) {
                      notify('Sincronize ou resolva os conflitos antes de sair. Seu backup também está disponível.');
                      return;
                    }
                    await onExit();
                  }}
                >
                  <LogOut size={15} /> {scope === 'demo' ? 'Entrar na minha conta' : 'Sair da conta'}
                </button>
              </article>
            </div>
            <article className="help-card">
              <h3>Atalhos de teclado e sintaxe</h3>
              <p>
                <code>⌘K</code> abre a busca rápida · <code>⌘N</code> cria documento · <code>⌘E</code> alterna Editar/Ler ·{' '}
                <code>⌘B</code>/<code>⌘I</code> formata texto selecionado.
              </p>
              <p>
                <code>[[Título]]</code> conecta notas · <code>#tema</code> cria uma tag · <code>$x^2$</code> escreve
                matemática.
              </p>
              <p>
                Nas planilhas: <code>=SOMA(A1:A5)</code>, <code>=MÉDIA(B1:B3)</code>, <code>=A1*2</code>. Use setas do
                teclado para navegar entre células.
              </p>
            </article>
          </section>
        ) : view === 'graph' ? (
          <Graph notes={live} links={links} scope={scope} selected={selected} onOpen={open} />
        ) : (
          <div className={'document-layout ' + (!showRightPanel ? 'no-right' : '')}>
            <section className="note-list">
              <div className="list-heading">
                <div>
                  <h2>
                    {view === 'trash'
                      ? 'Lixeira'
                      : view === 'search'
                        ? 'Buscar'
                        : filter === 'all'
                          ? 'Biblioteca'
                          : filter === 'notes'
                            ? 'Notas'
                            : filter === 'favorites'
                              ? 'Favoritas'
                              : filter === 'sheets'
                                ? 'Planilhas'
                                : filter.replace(/^(folder:|tag:)/, '')}
                  </h2>
                </div>
                <IconButton label="Novo documento" onClick={() => newDocument(filter === 'sheets' ? 'sheet' : 'note')}>
                  <Plus size={18} />
                </IconButton>
              </div>

              <div className="list-search">
                <Search size={15} />
                <input
                  aria-label="Buscar notas"
                  placeholder="Filtrar por título ou conteúdo…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus={view === 'search'}
                />
                {query && (
                  <button
                    type="button"
                    className="list-search-clear"
                    aria-label="Limpar busca"
                    onClick={() => setQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {view !== 'trash' && (
                <div className="library-chips" role="group" aria-label="Filtros rápidos">
                  {[
                    { id: 'all', label: 'Tudo' },
                    { id: 'notes', label: 'Notas' },
                    { id: 'sheets', label: 'Planilhas' },
                    { id: 'favorites', label: 'Favoritas' },
                  ].map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      className={filter === chip.id ? 'library-chip active' : 'library-chip'}
                      onClick={() => setFilter(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="list-count">
                {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
                <button
                  type="button"
                  className="sort-toggle"
                  onClick={() => setSortBy(s => (s === 'recent' ? 'alpha' : 'recent'))}
                >
                  <ArrowUpDown size={11} />
                  {sortBy === 'recent' ? 'Mais recentes' : 'Ordem A–Z'}
                </button>
              </div>

              <div className="note-items">
                {filtered.map(n => (
                  <button
                    type="button"
                    key={n.id}
                    className={'note-item ' + (selected === n.id ? 'selected' : '')}
                    onClick={() => {
                      if (view === 'trash') {
                        setSelected(n.id);
                        setView('trash-detail');
                      } else {
                        open(n.id);
                      }
                    }}
                  >
                    <div className="note-item-title">
                      {n.kind === 'sheet' ? <Table2 size={16} /> : <FileText size={16} />}
                      <strong>{n.title || 'Sem título'}</strong>
                      {n.favorite && <Star className="star" size={12} />}
                    </div>
                    <p>
                      {n.kind === 'sheet'
                        ? 'Planilha com fórmulas'
                        : n.content.replace(/[#*\[\]`$>]/g, '').slice(0, 110) || 'Sem conteúdo'}
                    </p>
                    <div className="note-item-meta">
                      <time>{date(n.updated_at)}</time>
                      {n.folder && <span>{n.folder}</span>}
                      {n.tags[0] && <span>#{n.tags[0]}</span>}
                    </div>
                  </button>
                ))}
                {!filtered.length && (
                  <div className="list-empty">
                    <BookOpen size={26} />
                    <p>{query ? 'Nenhum documento encontrado para esta busca.' : 'Seu próximo pensamento começa aqui.'}</p>
                    <button type="button" onClick={() => newDocument(filter === 'sheets' ? 'sheet' : 'note')}>
                      Criar documento
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className={'document ' + (note ? 'has-note' : '')}>
              {note && (!note.deleted_at || view === 'trash' || view === 'trash-detail') ? (
                <>
                  <div className="editor-toolbar">
                    <div className="toolbar-left">
                      <button
                        type="button"
                        className="editor-back"
                        onClick={() => {
                          setFocusMode(false);
                          setView(view === 'trash-detail' ? 'trash' : 'library');
                        }}
                      >
                        <ArrowLeft size={17} />
                        <span>{view === 'trash-detail' ? 'Lixeira' : 'Biblioteca'}</span>
                      </button>
                      <span>{note.kind === 'sheet' ? <Table2 size={16} /> : <FileText size={16} />}</span>
                      <span className="fine">{note.kind === 'sheet' ? 'PLANILHA' : 'NOTA'}</span>
                    </div>
                    <div className="toolbar-right">
                      {note.kind === 'note' && !note.deleted_at && (
                        <div className="segmented" role="group" aria-label="Modo de visualização">
                          <IconButton label="Escrever (⌘E)" active={editing === 'write'} onClick={() => setEditing('write')}>
                            <PenLine size={15} />
                            <span>Editar</span>
                          </IconButton>
                          <IconButton label="Ler (⌘E)" active={editing === 'read'} onClick={() => setEditing('read')}>
                            <Eye size={15} />
                            <span>Ler</span>
                          </IconButton>
                          <IconButton
                            label="Escrever e visualizar lado a lado"
                            active={editing === 'split'}
                            onClick={() => setEditing('split')}
                          >
                            <Columns2 size={15} />
                          </IconButton>
                        </div>
                      )}
                      {!note.deleted_at && (
                        <IconButton
                          label={focusMode ? 'Sair do modo foco (Esc)' : 'Modo foco'}
                          active={focusMode}
                          onClick={() => setFocusMode(f => !f)}
                        >
                          {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </IconButton>
                      )}
                      <IconButton
                        label={note.favorite ? 'Remover dos favoritos' : 'Favoritar'}
                        active={note.favorite}
                        onClick={() => vault.updateNote(note.id, { favorite: !note.favorite })}
                      >
                        <Star size={16} />
                      </IconButton>
                      <IconButton
                        label="Exportar documento"
                        onClick={() =>
                          download(
                            (note.title || 'documento') + (note.kind === 'sheet' ? '.csv' : '.md'),
                            note.kind === 'sheet' ? sheetToCsv(parseSheet(note.content)) : note.content,
                          )
                        }
                      >
                        <Download size={16} />
                      </IconButton>
                      {!note.deleted_at && (
                        <IconButton label="Mover para lixeira" onClick={() => trashWithUndo(note)}>
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </div>
                  </div>

                  {note.deleted_at ? (
                    <div className="empty-page">
                      <Trash2 size={34} />
                      <h2>{note.title}</h2>
                      <p>Esta nota está na lixeira.</p>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          vault.restore(note.id);
                          open(note.id);
                        }}
                      >
                        Restaurar nota
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="document-heading">
                        <div className="doc-folder">
                          <Folder size={13} />
                          <select
                            aria-label="Pasta da nota"
                            value={note.folder}
                            onChange={e => vault.updateNote(note.id, { folder: e.target.value })}
                          >
                            <option value="">Sem pasta</option>
                            {[...new Set([...state.folders, note.folder].filter(Boolean))].map(f => (
                              <option key={f}>{f}</option>
                            ))}
                          </select>
                          <span>·</span>
                          <time>Atualizada em {date(note.updated_at)}</time>
                        </div>

                        <input
                          ref={titleRef}
                          className="title-input"
                          aria-label="Título da nota"
                          maxLength={500}
                          value={note.title}
                          placeholder="Sem título"
                          onChange={e => vault.updateNote(note.id, { title: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && note.kind === 'note' && editing !== 'read') {
                              e.preventDefault();
                              setPendingFocus({ id: note.id, target: 'body' });
                            }
                          }}
                        />

                        {note.tags.length > 0 && (
                          <div className="doc-tags">
                            {note.tags.map(t => (
                              <button
                                type="button"
                                key={t}
                                onClick={() => {
                                  setFocusMode(false);
                                  browseDocuments('tag:' + t);
                                }}
                              >
                                #{t}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {note.kind === 'sheet' ? (
                        <Sheet
                          key={note.id}
                          note={note}
                          update={content => vault.updateNote(note.id, { content })}
                        />
                      ) : (
                        <Editor
                          key={note.id}
                          note={note}
                          mode={editing}
                          titles={new Set(links.byTitle.keys())}
                          titleDisplayMap={
                            new Map(live.map(n => [normTitle(n.title), n.title]))
                          }
                          autoFocusBody={pendingFocus?.id === note.id && pendingFocus.target === 'body'}
                          onFocusedBody={() => setPendingFocus(null)}
                          onChange={content => vault.updateNote(note.id, { content })}
                          onWiki={openWiki}
                          onStartEdit={() => setEditing('write')}
                        />
                      )}

                      <footer className="document-footer">
                        <span>
                          {note.kind === 'sheet'
                            ? 'Planilha com fórmulas'
                            : `${wordCount} ${wordCount === 1 ? 'palavra' : 'palavras'} · ~${readMinutes} min de leitura`}
                        </span>
                        <span>
                          <Check size={12} /> {scope === 'demo' ? 'Armazenamento local' : statusText}
                        </span>
                      </footer>
                    </>
                  )}
                </>
              ) : (
                <div className="empty-page">
                  <span className="empty-mark">
                    <PenLine size={32} />
                  </span>
                  <h1>Seu caderno começa aqui</h1>
                  <p>Crie uma nota ou abra um documento da biblioteca.</p>
                  <button type="button" className="primary" onClick={() => newDocument('note')}>
                    <Plus size={17} /> Criar minha primeira nota
                  </button>
                  {scope !== 'demo' && live.length === 0 && state.hydrated && (
                    <button type="button" className="text-button" onClick={() => seed(vault)}>
                      Adicionar exemplos para explorar
                    </button>
                  )}
                </div>
              )}
            </section>

            {showRightPanel && (
              <aside className="context-panel">
                <div className="context-title">
                  <span>CONEXÕES DA NOTA</span>
                  <button
                    type="button"
                    className="context-graph-link"
                    title="Abrir mapa completo"
                    onClick={() => setView('graph')}
                  >
                    <Network size={14} /> Mapa
                  </button>
                </div>
                <MiniGraph note={note ?? null} notes={live} onOpen={open} />
                <div className="context-section">
                  <h3>
                    <Link2 size={15} /> Referências a esta nota{' '}
                    <span>{selected ? links.backlinks.get(selected)?.length ?? 0 : 0}</span>
                  </h3>
                  {(selected ? links.backlinks.get(selected) ?? [] : []).map(id => (
                    <button type="button" className="related-note" key={id} onClick={() => open(id)}>
                      <FileText size={14} />
                      <span>{state.notes[id]?.title}</span>
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                  {!links.backlinks.get(selected ?? '')?.length && (
                    <p className="fine">Notas que mencionarem esta página aparecerão aqui.</p>
                  )}
                </div>
                <div className="context-section">
                  <h3>
                    <ArrowUpRight size={15} /> Links nesta nota
                  </h3>
                  {(links.outgoing.get(selected ?? '') ?? []).map(id => (
                    <button type="button" className="related-note" key={id} onClick={() => open(id)}>
                      <FileText size={14} />
                      <span>{state.notes[id]?.title}</span>
                    </button>
                  ))}
                  {(links.missing.get(selected ?? '') ?? []).map(title => (
                    <button type="button" className="related-note" key={title} onClick={() => openWiki(title)}>
                      <Plus size={14} />
                      <span>Criar “{title}”</span>
                    </button>
                  ))}
                  {!(links.outgoing.get(selected ?? '')?.length || links.missing.get(selected ?? '')?.length) && (
                    <p className="fine">Use <code>[[Título]]</code> para ligar esta nota a outra.</p>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Navegação principal">
        <button type="button" className={view === 'home' ? 'selected' : ''} onClick={goHome}>
          <House size={20} />
          Início
        </button>
        <button
          type="button"
          className={view === 'library' || view === 'notes' ? 'selected' : ''}
          onClick={() => browseDocuments()}
        >
          <FileText size={20} />
          Biblioteca
        </button>
        <button type="button" className="mobile-add" aria-label="Criar documento" onClick={() => newDocument('note')}>
          <Plus size={24} />
        </button>
        <button type="button" className={paletteOpen ? 'selected' : ''} onClick={() => setPaletteOpen(true)}>
          <Search size={20} />
          Buscar
        </button>
        <button type="button" className={view === 'graph' ? 'selected' : ''} onClick={() => setView('graph')}>
          <Network size={20} />
          Conexões
        </button>
      </nav>

      <input
        hidden
        type="file"
        ref={importRef}
        multiple
        accept=".md,.txt,.json"
        onChange={e => void importFiles(e.target.files)}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        notes={live}
        folders={folders}
        tags={tags}
        dark={dark}
        onOpenNote={open}
        onCreate={kind => newDocument(kind)}
        onDaily={daily}
        onGoHome={goHome}
        onGoGraph={() => {
          setFocusMode(false);
          setView('graph');
        }}
        onGoSettings={() => {
          setFocusMode(false);
          setView('settings');
        }}
        onFilterFolder={f => browseDocuments('folder:' + f)}
        onFilterTag={t => browseDocuments('tag:' + t)}
        onToggleTheme={onToggleTheme}
      />

      {showNew && (
        <Modal title={newKind === 'sheet' ? 'Nova planilha' : 'Nova nota'} onClose={() => setShowNew(false)}>
          <form
            onSubmit={e => {
              e.preventDefault();
              create();
            }}
          >
            <div className="kind-picker">
              <button
                type="button"
                className={newKind === 'note' ? 'selected' : ''}
                onClick={() => setNewKind('note')}
              >
                <FileText />
                Nota
              </button>
              <button
                type="button"
                className={newKind === 'sheet' ? 'selected' : ''}
                onClick={() => setNewKind('sheet')}
              >
                <Table2 />
                Planilha
              </button>
            </div>
            <label>
              Título
              <input
                autoFocus
                required
                maxLength={500}
                placeholder={newKind === 'sheet' ? 'Ex.: Planejamento mensal' : 'Ex.: Ideias para o projeto'}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </label>
            <button className="primary wide" type="submit">
              Criar {newKind === 'sheet' ? 'planilha' : 'nota'} <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}

      {showFolder && (
        <Modal title="Uma pasta para organizar" onClose={() => setShowFolder(false)}>
          <form
            onSubmit={e => {
              e.preventDefault();
              vault.addFolder(folderName);
              setFolderName('');
              setShowFolder(false);
            }}
          >
            <label>
              Nome da pasta
              <input
                autoFocus
                required
                maxLength={500}
                placeholder="Ex.: Estudos, Projetos…"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
              />
            </label>
            <button className="primary wide">Criar pasta</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={e => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <IconButton label="Fechar" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

function Editor({
  note,
  mode,
  titles,
  titleDisplayMap,
  autoFocusBody,
  onFocusedBody,
  onChange,
  onWiki,
  onStartEdit,
}: {
  note: Note;
  mode: 'write' | 'read' | 'split';
  titles: Set<string>;
  titleDisplayMap: Map<string, string>;
  autoFocusBody?: boolean;
  onFocusedBody?: () => void;
  onChange: (s: string) => void;
  onWiki: (s: string) => void;
  onStartEdit: () => void;
}) {
  const [calc, setCalc] = useState(false);
  const [expression, setExpression] = useState('');
  const [suggest, setSuggest] = useState('');
  const [suggestIndex, setSuggestIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => renderMarkdown(note.content, titles), [note.content, [...titles].join('|')]);
  const result = expression ? calculate(expression) : null;

  const suggestions = useMemo(() => {
    if (!suggest) return [];
    const needle = suggest.toLocaleLowerCase('pt-BR');
    return [...titles]
      .filter(t => t.includes(needle))
      .slice(0, 5)
      .map(key => titleDisplayMap.get(key) ?? key);
  }, [suggest, titles, titleDisplayMap]);

  useEffect(() => {
    setSuggestIndex(0);
  }, [suggest]);

  useEffect(() => {
    if (autoFocusBody && mode !== 'read' && ref.current) {
      const el = ref.current;
      requestAnimationFrame(() => {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
        onFocusedBody?.();
      });
    }
  }, [autoFocusBody, mode, onFocusedBody]);

  function wrapOrInsert(before: string, after: string, fallback: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? note.content.length;
    const end = el?.selectionEnd ?? start;
    const selectedText = note.content.slice(start, end);
    const inner = selectedText || fallback;
    const next = note.content.slice(0, start) + before + inner + after + note.content.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const selStart = start + before.length;
      const selEnd = selStart + inner.length;
      el?.setSelectionRange(selStart, selEnd);
    });
  }

  function insert(s: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? note.content.length;
    const end = el?.selectionEnd ?? start;
    onChange(note.content.slice(0, start) + s + note.content.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + s.length, start + s.length);
    });
  }

  function applyLinePrefix(kind: 'bullet' | 'numbered' | 'task' | 'quote') {
    const el = ref.current;
    const content = note.content;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? start;
    const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextNewline = content.indexOf('\n', end);
    const lineEnd = nextNewline === -1 ? content.length : nextNewline;
    const block = content.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const transformed = lines
      .map((line, i) => {
        const clean = line.replace(/^(\s*)(?:[-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+\.\s+|>\s+)/, '$1');
        const indent = /^(\s*)/.exec(clean)?.[1] ?? '';
        const body = clean.slice(indent.length);
        if (kind === 'bullet') return `${indent}- ${body}`;
        if (kind === 'numbered') return `${indent}${i + 1}. ${body}`;
        if (kind === 'task') return `${indent}- [ ] ${body}`;
        return `${indent}> ${body}`;
      })
      .join('\n');
    const next = content.slice(0, lineStart) + transformed + content.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = lineStart + transformed.length;
      el?.setSelectionRange(cursor, cursor);
    });
  }

  function acceptSuggestion(label: string) {
    const el = ref.current;
    if (!el) return;
    const p = el.selectionStart;
    const next = note.content.slice(0, p - suggest.length) + label + ']]' + note.content.slice(p);
    onChange(next);
    setSuggest('');
    requestAnimationFrame(() => {
      el.focus();
      const cursor = p - suggest.length + label.length + 2;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleTextareaKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestIndex(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestIndex(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        acceptSuggestion(suggestions[suggestIndex] ?? suggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggest('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const el = e.currentTarget;
      const pos = el.selectionStart;
      if (pos === el.selectionEnd) {
        const lineStart = note.content.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
        const currentLine = note.content.slice(lineStart, pos);
        const taskMatch = /^(\s*)([-*]\s+\[[ xX]\]\s+)(.*)$/.exec(currentLine);
        const numMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(currentLine);
        const bulletMatch = /^(\s*)([-*])\s+(.*)$/.exec(currentLine);
        if (taskMatch) {
          e.preventDefault();
          if (!taskMatch[3].trim()) {
            const next = note.content.slice(0, lineStart) + note.content.slice(pos);
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
          } else {
            insert(`\n${taskMatch[1]}- [ ] `);
          }
          return;
        }
        if (numMatch) {
          e.preventDefault();
          if (!numMatch[3].trim()) {
            const next = note.content.slice(0, lineStart) + note.content.slice(pos);
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
          } else {
            insert(`\n${numMatch[1]}${Number(numMatch[2]) + 1}. `);
          }
          return;
        }
        if (bulletMatch) {
          e.preventDefault();
          if (!bulletMatch[3].trim()) {
            const next = note.content.slice(0, lineStart) + note.content.slice(pos);
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
          } else {
            insert(`\n${bulletMatch[1]}${bulletMatch[2]} `);
          }
          return;
        }
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapOrInsert('**', '**', 'texto em destaque');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapOrInsert('*', '*', 'texto em itálico');
    }
  }

  function toggleTaskAtIndex(checkboxIndex: number) {
    let seen = 0;
    const updated = note.content.replace(/^(\s*[-*]\s+\[)( |x|X)(\])/gm, (match, pre, stateChar, post) => {
      if (seen++ !== checkboxIndex) return match;
      return `${pre}${stateChar === ' ' ? 'x' : ' '}${post}`;
    });
    if (updated !== note.content) onChange(updated);
  }

  return (
    <>
      {mode !== 'read' && (
        <>
          <p className="editor-hint">
            Use <code>[[Título da nota]]</code> para conectar ideias e <code>#tema</code> para organizar.
          </p>
          <div className="format-toolbar">
            <div>
              <button type="button" onClick={() => wrapOrInsert('**', '**', 'texto em destaque')} title="Negrito (⌘B)">
                <b>B</b>
              </button>
              <button type="button" onClick={() => wrapOrInsert('*', '*', 'texto em itálico')} title="Itálico (⌘I)">
                <i>I</i>
              </button>
              <button type="button" onClick={() => insert('\n## Título\n')} title="Subtítulo">
                H₂
              </button>
              <button type="button" onClick={() => wrapOrInsert('`', '`', 'código')} title="Código">
                <Code2 size={15} />
              </button>
              <span />
              <button type="button" onClick={() => applyLinePrefix('bullet')} title="Lista com marcadores" aria-label="Lista com marcadores">
                <List size={16} />
              </button>
              <button type="button" onClick={() => applyLinePrefix('numbered')} title="Lista numerada" aria-label="Lista numerada">
                <ListOrdered size={16} />
              </button>
              <button type="button" onClick={() => applyLinePrefix('task')} title="Lista de tarefas" aria-label="Lista de tarefas">
                <Check size={16} />
              </button>
              <button type="button" onClick={() => applyLinePrefix('quote')} title="Citação" aria-label="Citação">
                <Quote size={15} />
              </button>
              <button type="button" onClick={() => insert('\n---\n')} title="Linha divisória" aria-label="Linha divisória">
                <Minus size={15} />
              </button>
              <span />
              <button type="button" onClick={() => wrapOrInsert('[[', ']]', 'Nome da nota')} title="Conectar nota" aria-label="Conectar nota">
                <Link2 size={16} />
              </button>
              <button type="button" onClick={() => wrapOrInsert('$', '$', 'x^2')} title="Inserir fórmula">
                ƒx
              </button>
            </div>
            <button type="button" className={calc ? 'active' : ''} onClick={() => setCalc(!calc)}>
              <Calculator size={14} />
              <span>Calculadora</span>
            </button>
          </div>
          {calc && (
            <div className="calculator">
              <input
                aria-label="Expressão matemática"
                placeholder="Ex.: (150 + 35) * 2"
                value={expression}
                onChange={e => setExpression(e.target.value)}
              />
              <strong>{result?.ok ? formatNumber(result.value) : result?.error ?? '='}</strong>
              <button
                type="button"
                disabled={!result?.ok}
                onClick={() => {
                  if (result?.ok) insert(`\n${expression} = ${formatNumber(result.value)}\n`);
                }}
              >
                Inserir resultado
              </button>
            </div>
          )}
        </>
      )}

      <div className={'editor-content mode-' + mode}>
        {mode !== 'read' && (
          <div className="write-pane">
            <textarea
              ref={ref}
              aria-label="Conteúdo da nota"
              spellCheck
              placeholder="Comece a escrever. Use [[ para conectar ideias…"
              value={note.content}
              onKeyDown={handleTextareaKeyDown}
              onChange={e => {
                onChange(e.target.value);
                const left = e.target.value.slice(0, e.target.selectionStart);
                const m = /\[\[([^\]\n]*)$/.exec(left);
                setSuggest(m ? m[1] : '');
              }}
            />
            {suggestions.length > 0 && (
              <div className="wiki-suggestions" role="listbox" aria-label="Sugestões de notas">
                {suggestions.map((label, idx) => (
                  <button
                    type="button"
                    key={label}
                    role="option"
                    aria-selected={idx === suggestIndex}
                    className={idx === suggestIndex ? 'active' : ''}
                    onMouseDown={e => {
                      e.preventDefault();
                      acceptSuggestion(label);
                    }}
                  >
                    <FileText size={13} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {mode !== 'write' && (
          <article
            className="markdown"
            onClick={e => {
              const el = e.target as HTMLElement;
              if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
                const boxes = Array.from(
                  e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
                );
                const idx = boxes.indexOf(el as HTMLInputElement);
                if (idx >= 0) {
                  e.preventDefault();
                  toggleTaskAtIndex(idx);
                }
                return;
              }
              const target = el.closest('[data-wikilink]');
              if (target) {
                e.preventDefault();
                onWiki(target.getAttribute('data-wikilink')!);
              }
            }}
            onDoubleClick={e => {
              const el = e.target as HTMLElement;
              if (mode === 'read' && !el.closest('a, input, button')) {
                onStartEdit();
              }
            }}
            dangerouslySetInnerHTML={{
              __html: html || '<p class="muted">Uma página em branco. Clique em Editar ou dê dois cliques para começar.</p>',
            }}
          />
        )}
      </div>
    </>
  );
}

function Sheet({ note, update }: { note: Note; update: (s: string) => void }) {
  const data = useMemo(() => parseSheet(note.content), [note.content]);
  const results = useMemo(() => computeSheet(data), [data]);
  const [pos, setPos] = useState({ col: 0, row: 0 });
  const cell = refName(pos.col, pos.row);
  const [draft, setDraft] = useState(data.cells[cell] ?? '');
  const formulaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(data.cells[cell] ?? '');
  }, [cell, note.content]);

  function save(value: string) {
    update(JSON.stringify({ ...data, cells: { ...data.cells, [cell]: value } }));
  }

  function handleCellKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, c: number, r: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPos({ col: Math.min(data.cols - 1, c + 1), row: r });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPos({ col: Math.max(0, c - 1), row: r });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPos({ col: c, row: Math.min(data.rows - 1, r + 1) });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPos({ col: c, row: Math.max(0, r - 1) });
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      formulaRef.current?.focus();
    }
  }

  return (
    <div className="sheet-wrap">
      <div className="formula-bar">
        <strong>{cell}</strong>
        <span>ƒx</span>
        <input
          ref={formulaRef}
          aria-label={'Valor ou fórmula de ' + cell}
          value={draft}
          placeholder="Digite um valor ou =SOMA(A1:A5)"
          onChange={e => {
            setDraft(e.target.value);
            save(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setPos(p => ({ col: p.col, row: Math.min(data.rows - 1, p.row + 1) }));
            } else if (e.key === 'Escape') {
              e.currentTarget.blur();
            }
          }}
        />
      </div>
      <div className="sheet-scroll">
        <table className="sheet">
          <thead>
            <tr>
              <th />
              {Array.from({ length: data.cols }, (_, c) => (
                <th key={c} className={c === pos.col ? 'active-header' : ''}>
                  {colName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: data.rows }, (_, r) => (
              <tr key={r}>
                <th className={r === pos.row ? 'active-header' : ''}>{r + 1}</th>
                {Array.from({ length: data.cols }, (_, c) => {
                  const name = refName(c, r);
                  return (
                    <td
                      key={c}
                      className={(name === cell ? 'selected ' : '') + (results[name]?.error ? 'cell-error' : '')}
                    >
                      <button
                        type="button"
                        aria-label={name + ': ' + (displayCell(results[name]) || 'vazia')}
                        onClick={() => setPos({ col: c, row: r })}
                        onDoubleClick={() => {
                          setPos({ col: c, row: r });
                          formulaRef.current?.focus();
                        }}
                        onKeyDown={e => handleCellKeyDown(e, c, r)}
                      >
                        {displayCell(results[name])}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sheet-bottom">
        <button
          type="button"
          disabled={data.rows >= 500}
          onClick={() => update(JSON.stringify({ ...data, rows: Math.min(500, data.rows + 10) }))}
        >
          <Plus size={13} /> 10 linhas
        </button>
        <button
          type="button"
          disabled={data.cols >= 52}
          onClick={() => update(JSON.stringify({ ...data, cols: data.cols + 1 }))}
        >
          <Plus size={13} /> Coluna
        </button>
        <span>Use as setas para navegar e Enter para editar na barra ƒx.</span>
      </div>
    </div>
  );
}

function MiniGraph({ note, notes, onOpen }: { note: Note | null; notes: Note[]; onOpen: (id: string) => void }) {
  if (!note)
    return (
      <div className="mini-graph">
        <Network size={40} />
      </div>
    );
  const idx = buildLinkIndex(notes);
  const ids = [...new Set([...(idx.outgoing.get(note.id) ?? []), ...(idx.backlinks.get(note.id) ?? [])])].slice(0, 6);
  return (
    <svg className="mini-graph" viewBox="0 0 240 180" aria-label="Conexões próximas">
      {ids.map((id, i) => {
        const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
        const x = 120 + 74 * Math.cos(a);
        const y = 88 + 56 * Math.sin(a);
        const targetNote = notes.find(n => n.id === id);
        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(id);
              }
            }}
          >
            <line x1="120" y1="88" x2={x} y2={y} />
            <circle cx={x} cy={y} r="6.5" />
            <text x={x} y={y + 17} textAnchor="middle">
              {targetNote?.title.slice(0, 16)}
            </text>
          </g>
        );
      })}
      <circle className="center-node" cx="120" cy="88" r="10" />
      <text x="120" y="112" textAnchor="middle" fontWeight="600">
        {note.title.slice(0, 21)}
      </text>
    </svg>
  );
}
