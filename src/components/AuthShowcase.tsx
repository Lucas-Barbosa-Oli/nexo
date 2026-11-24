import { useState } from 'react';
import { BookOpen, FileText, Network, Table2 } from 'lucide-react';

const HIGHLIGHTS = [
  {
    id: 'notes',
    label: 'Notas vivas',
    caption: 'Markdown limpo, tarefas clicáveis e fórmulas matemáticas.',
    icon: FileText,
    snippet: '# Ideia do dia · [[Meu segundo cérebro]]',
  },
  {
    id: 'links',
    label: 'Conexões',
    caption: 'Mapa interativo que revela como seus temas se cruzam.',
    icon: Network,
    snippet: '3 referências cruzadas encontradas',
  },
  {
    id: 'sheets',
    label: 'Planilhas',
    caption: 'Cálculos rápidos com =SOMA e =MÉDIA no mesmo espaço.',
    icon: Table2,
    snippet: 'Total =SOMA(B2:B4) → R$ 2.300',
  },
  {
    id: 'brain',
    label: 'Sempre seu',
    caption: 'Sincronizado na nuvem com backup completo em 1 clique.',
    icon: BookOpen,
    snippet: 'Offline + sincronização automática',
  },
] as const;

export default function AuthShowcase() {
  const [active, setActive] = useState<(typeof HIGHLIGHTS)[number]['id']>('notes');
  const current = HIGHLIGHTS.find(item => item.id === active) ?? HIGHLIGHTS[0];

  return (
    <div className="auth-showcase" aria-label="Recursos do Nexo">
      <div className="auth-constellation" aria-hidden="true">
        <svg viewBox="0 0 360 88" fill="none">
          <path
            d="M44 44 C100 18, 128 18, 180 44 C232 70, 260 70, 316 44"
            stroke="var(--selection-line)"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />
          <line x1="44" y1="44" x2="180" y2="44" stroke="var(--line)" strokeWidth="1" />
          <line x1="180" y1="44" x2="316" y2="44" stroke="var(--line)" strokeWidth="1" />
          <circle cx="44" cy="44" r={active === 'notes' ? 9 : 6} fill="var(--graph-note)" />
          <circle cx="136" cy="28" r={active === 'links' ? 9 : 6} fill="var(--accent)" />
          <circle cx="224" cy="60" r={active === 'sheets' ? 9 : 6} fill="var(--graph-sheet)" />
          <circle cx="316" cy="44" r={active === 'brain' ? 9 : 6} fill="var(--graph-note)" />
        </svg>
        <div className="auth-preview-pill">
          <span className="status-dot" />
          <code>{current.snippet}</code>
        </div>
      </div>

      <div className="auth-pillars" role="tablist" aria-label="Destaques do Nexo">
        {HIGHLIGHTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={active === id ? 'auth-pillar active' : 'auth-pillar'}
            onClick={() => setActive(id)}
            onMouseEnter={() => setActive(id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p className="auth-pillar-caption">{current.caption}</p>
    </div>
  );
}
