import { useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { ArrowUpRight, FileText, Focus, Minus, Network, Pin, Plus, RotateCcw, Search, Table2 } from 'lucide-react';
import type { LinkIndex } from '../lib/links';
import type { Note } from '../lib/vault';

type Point = { x: number; y: number };
type Camera = Point & { zoom: number };
type LayoutNode = SimulationNodeDatum & Point & { id: string };
type Edge = { source: string; target: string };
type Gesture = { id: string | null; start: Point; moved: boolean; offset: Point };

const origin = { x: 0, y: 0 };
const defaultCamera = { ...origin, zoom: 1 };
const nodeLimit = 150;
const clampZoom = (zoom: number) => Math.min(3, Math.max(.15, zoom));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function zoomAt(camera: Camera, factor: number, from: Point, to = from): Camera {
  const zoom = clampZoom(camera.zoom * factor);
  const ratio = zoom / camera.zoom;
  return { x: to.x - (from.x - camera.x) * ratio, y: to.y - (from.y - camera.y) * ratio, zoom };
}

function readPins(key: string) {
  try {
    const entries: [string, Point][] = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Map(entries.filter(([id, point]) =>
      typeof id === 'string' && Number.isFinite(point?.x) && Number.isFinite(point?.y)));
  } catch {
    return new Map<string, Point>();
  }
}

function fitCamera(nodes: LayoutNode[], width: number, height: number): Camera {
  if (!nodes.length || !width || !height) return defaultCamera;
  const xs = nodes.map(node => node.x);
  const ys = nodes.map(node => node.y);
  const left = Math.min(...xs), right = Math.max(...xs);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const zoom = clampZoom(Math.min(1, width / (right - left + 190), height / (bottom - top + 140)));
  return { x: -(left + right) * zoom / 2, y: -(top + bottom) * zoom / 2, zoom };
}

export default function Graph({ notes, links, scope, selected, onOpen }: {
  notes: Note[];
  links: LinkIndex;
  scope: string;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [camera, setCamera] = useState<Camera>(defaultCamera);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState(new Map<string, Point>());
  const [hovered, setHovered] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const simulation = useRef<Simulation<LayoutNode, SimulationLinkDatum<LayoutNode>> | null>(null);
  const nodes = useRef(new Map<string, LayoutNode>());
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastFilter = useRef('');
  const pinKey = 'nexo:graph-pins:v1:' + scope;
  const [pins, setPins] = useState(() => readPins(pinKey));
  const normalized = query.trim().toLocaleLowerCase('pt-BR');

  const matching = useMemo(() => notes.filter(note =>
    note.title.toLocaleLowerCase('pt-BR').includes(normalized)), [notes, normalized]);
  const visible = useMemo(() => matching.slice(0, nodeLimit), [matching]);
  const model = useMemo(() => {
    const neighbors = new Map(visible.map(note => [note.id, new Set<string>()]));
    const edges: Edge[] = [];
    for (const { id } of visible) {
      const adjacent = neighbors.get(id)!;
      for (const target of links.outgoing.get(id) ?? []) {
        const other = neighbors.get(target);
        if (!other || adjacent.has(target)) continue;
        adjacent.add(target);
        other.add(id);
        edges.push({ source: id, target });
      }
    }
    return { edges, neighbors };
  }, [visible, links]);
  // Cloud pulls can refresh note objects without changing the connections.
  const topology = useMemo(() => JSON.stringify([visible.map(note => note.id), model.edges]), [visible, model]);

  useEffect(() => {
    const canvas = svg.current!;
    const measure = () => setSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(canvas);

    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      const anchor = { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1);
      setCamera(current => zoomAt(current, Math.exp(-delta * .0015), anchor));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      resize.disconnect();
      canvas.removeEventListener('wheel', wheel);
    };
  }, []);

  const startLayout = useEffectEvent(() => {
    const previous = nodes.current;
    const layout = visible.map(({ id }, index): LayoutNode => {
      const old = previous.get(id);
      const dragging = gesture.current?.moved && gesture.current.id === id;
      const saved = dragging ? old : pins.get(id);
      const angle = index * 2.39996;
      const radius = 28 * Math.sqrt(index);
      const point = saved ?? old ?? { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      return { id, x: point.x, y: point.y, fx: saved?.x, fy: saved?.y };
    });
    nodes.current = new Map(layout.map(node => [node.id, node]));
    const publish = () => setPositions(new Map(layout.map(({ id, x, y }) => [id, { x, y }])));
    const sim = forceSimulation(layout).stop()
      .force('links', forceLink<LayoutNode, SimulationLinkDatum<LayoutNode>>(
        model.edges.map(edge => ({ ...edge }))).id(node => node.id).distance(135))
      .force('repulsion', forceManyBody().strength(-560))
      .force('collision', forceCollide(29))
      .force('x', forceX(0).strength(.045))
      .force('y', forceY(0).strength(.045))
      .on('tick', publish);
    simulation.current = sim;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    sim.tick(reduceMotion ? 160 : 48);
    publish();
    if (!previous.size || lastFilter.current !== normalized) {
      const canvas = svg.current!;
      setCamera(fitCamera(layout, canvas.clientWidth, canvas.clientHeight));
    }
    lastFilter.current = normalized;
    if (layout.length > 1 && !reduceMotion) sim.restart();
    return () => { sim.stop(); };
  });
  useEffect(() => startLayout(), [topology, layoutVersion]);

  function savePins(next: Map<string, Point>) {
    setPins(next);
    try {
      localStorage.setItem(pinKey, JSON.stringify([...next]));
    } catch {
      // Keep the current layout usable when the browser blocks local storage.
    }
  }

  function endDrag(id: string) {
    const node = nodes.current.get(id);
    if (!node || node.fx == null || node.fy == null) return;
    savePins(new Map(pins).set(id, { x: node.fx, y: node.fy }));
    simulation.current?.alphaTarget(0);
  }

  function pointAt(event: PointerEvent<SVGSVGElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 };
  }

  function startPointer(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || pointers.current.size >= 2) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointAt(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 2) {
      const current = gesture.current;
      if (current?.id && current.moved) endDrag(current.id);
      gesture.current = { id: null, start: point, moved: true, offset: origin };
      setHovered(null);
      setMoving(true);
      return;
    }
    const id = (event.target as Element).closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    const node = id ? nodes.current.get(id) : undefined;
    const offset = node ? {
      x: node.x - (point.x - camera.x) / camera.zoom,
      y: node.y - (point.y - camera.y) / camera.zoom,
    } : origin;
    gesture.current = { id, start: point, moved: false, offset };
  }

  function movePointer(event: PointerEvent<SVGSVGElement>) {
    const previous = pointers.current.get(event.pointerId);
    const current = gesture.current;
    if (!previous || !current) return;
    const point = pointAt(event);
    pointers.current.set(event.pointerId, point);
    if (!current.moved && distance(point, current.start) < 5) return;
    if (!current.moved) {
      current.moved = true;
      setMoving(true);
      setHovered(current.id);
      if (current.id && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        simulation.current?.alphaTarget(.22).restart();
      }
    }

    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      setCamera(state => zoomAt(state, distance(point, other) / Math.max(1, distance(previous, other)),
        midpoint(previous, other), midpoint(point, other)));
    } else if (current.id) {
      const node = nodes.current.get(current.id);
      if (!node) return;
      node.x = node.fx = (point.x - camera.x) / camera.zoom + current.offset.x;
      node.y = node.fy = (point.y - camera.y) / camera.zoom + current.offset.y;
      setPositions(state => new Map(state).set(node.id, { x: node.x, y: node.y }));
    } else {
      setCamera(state => ({ ...state, x: state.x + point.x - previous.x, y: state.y + point.y - previous.y }));
    }
  }

  function finishPointer(event: PointerEvent<SVGSVGElement>, activate: boolean) {
    if (!pointers.current.delete(event.pointerId) || pointers.current.size) return;
    const current = gesture.current;
    gesture.current = null;
    setMoving(false);
    if (current?.id && current.moved) {
      endDrag(current.id);
      if (event.pointerType !== 'mouse') {
        setHovered(null);
        setInspected(current.id);
      }
      return;
    }
    if (!activate || current?.moved) return;
    if (current?.id && event.pointerType === 'mouse') onOpen(current.id);
    else setInspected(current?.id ?? null);
  }

  function resetLayout() {
    savePins(new Map());
    nodes.current.clear();
    setHovered(null);
    setInspected(null);
    setLayoutVersion(version => version + 1);
  }

  const focused = visible.find(note => note.id === (hovered ?? inspected));
  const related = focused ? model.neighbors.get(focused.id) : undefined;
  const count = model.edges.length;
  const connectionLabel = (total: number) => total === 1 ? '1 conexão' : total + ' conexões';

  return (
    <section className="graph-page" aria-labelledby="graph-title">
      <header className="graph-header">
        <div>
          <h1 id="graph-title">Conexões</h1>
          <p>{visible.length} de {notes.length} documentos <span aria-hidden="true">·</span> {connectionLabel(count)}</p>
        </div>
        <label className="list-search graph-search">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Buscar no grafo" placeholder="Filtrar por título…" value={query} onChange={event => {
            setQuery(event.target.value);
            setInspected(null);
            setHovered(null);
          }} />
        </label>
      </header>
      <div className="graph-canvas">
        <svg ref={svg} className={moving ? 'graph-surface moving' : 'graph-surface'}
          role="group" aria-label="Grafo de notas"
          onPointerDown={startPointer} onPointerMove={movePointer}
          onPointerUp={event => finishPointer(event, true)}
          onPointerCancel={event => finishPointer(event, false)}
          onLostPointerCapture={event => finishPointer(event, false)}>
          <g transform={`translate(${size.width / 2 + camera.x}, ${size.height / 2 + camera.y}) scale(${camera.zoom})`}>
            {model.edges.map(({ source, target }) => {
              const a = positions.get(source), b = positions.get(target);
              if (!a || !b) return null;
              const active = focused?.id === source || focused?.id === target;
              return <line key={source + ':' + target} className={`graph-edge${active ? ' highlighted' : focused ? ' faded' : ''}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
            })}
            {visible.map(note => {
              const point = positions.get(note.id);
              if (!point) return null;
              const active = focused?.id === note.id;
              const radius = 7 + Math.min(8, Math.sqrt(model.neighbors.get(note.id)?.size ?? 0) * 2);
              const title = note.title || 'Sem título';
              return <g key={note.id} data-node-id={note.id}
                className={`graph-node ${note.kind}${active ? ' highlighted' : ''}${focused && !active && !related?.has(note.id) ? ' faded' : ''}${note.id === selected ? ' current' : ''}`}
                transform={`translate(${point.x}, ${point.y})`} tabIndex={0} role="button"
                aria-label={'Abrir ' + title}
                onPointerEnter={event => { if (event.pointerType === 'mouse' && !gesture.current) setHovered(note.id); }}
                onPointerLeave={() => { if (!gesture.current) setHovered(null); }}
                onFocus={() => setHovered(note.id)} onBlur={() => setHovered(null)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(note.id);
                  }
                }}>
                <circle className="graph-hit" r={Math.max(20 / camera.zoom, radius + 5)} />
                <circle className="graph-halo" r={radius + 5} />
                <circle className="graph-dot" r={radius} />
                {(active || camera.zoom >= .55 || visible.length <= 12) && <text y={radius + 19} textAnchor="middle">
                  {title.length > 30 ? title.slice(0, 29) + '…' : title}
                </text>}
              </g>;
            })}
          </g>
        </svg>
        {!visible.length && <div className="graph-empty">
          <Network size={30} />
          <strong>{query.trim() ? 'Nenhum documento encontrado' : 'Seu mapa começa aqui'}</strong>
          <span>{query.trim() ? 'Experimente outro título.' : 'Crie uma nota e use [[Título]] para conectar suas ideias.'}</span>
        </div>}
        {matching.length > nodeLimit && <p className="graph-limit">Mostrando {nodeLimit} documentos. Filtre por título para ver outros.</p>}
        <div className="graph-legend" aria-label="Legenda">
          <span><i /> Nota</span><span><i /> Planilha</span>
        </div>
        {focused && <div className={`graph-inspector${inspected === focused.id ? ' interactive' : ''}`}>
          {focused.kind === 'sheet' ? <Table2 size={19} /> : <FileText size={19} />}
          <div><strong>{focused.title || 'Sem título'}</strong>
            <small>{connectionLabel(related?.size ?? 0)}{pins.has(focused.id) && <><span aria-hidden="true">·</span><Pin size={11} /> Fixada</>}</small>
          </div>
          {inspected === focused.id && <button type="button" className="secondary" onClick={() => onOpen(focused.id)}>Abrir <ArrowUpRight size={14} /></button>}
        </div>}
        <div className="graph-controls" role="group" aria-label="Controles do grafo">
          <button type="button" title="Diminuir zoom" aria-label="Diminuir zoom" onClick={() => setCamera(state => zoomAt(state, 1 / 1.25, origin))}><Minus size={17} /></button>
          <span>{Math.round(camera.zoom * 100)}%</span>
          <button type="button" title="Aumentar zoom" aria-label="Aumentar zoom" onClick={() => setCamera(state => zoomAt(state, 1.25, origin))}><Plus size={17} /></button>
          <button type="button" title="Enquadrar grafo" aria-label="Enquadrar grafo" onClick={() => setCamera(fitCamera([...nodes.current.values()], size.width, size.height))}><Focus size={17} /></button>
          <button type="button" title="Reorganizar e soltar os nós fixados" aria-label="Reorganizar grafo" onClick={resetLayout}><RotateCcw size={16} /></button>
        </div>
      </div>
      <footer className="graph-footer">
        <span className="graph-mouse-help">Arraste um nó para fixar sua posição. Arraste o fundo para navegar e use a roda para ampliar.</span>
        <span className="graph-touch-help">Arraste um nó para fixar. Use dois dedos para ampliar e toque em uma nota para ver os detalhes.</span>
      </footer>
    </section>
  );
}
