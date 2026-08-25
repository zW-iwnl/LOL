import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { ChevronDown, ChevronRight, Home, Maximize2, Minimize2, Star } from "lucide-react";
import {
  getSuiteTrail,
  getVisibleSuiteRows,
  matchingSuiteIds,
  REPOSITORY_ROOT_LABEL,
  type SuiteIndex,
  type SuiteSelection,
} from "./suiteTree";

type MindMapViewProps = {
  index: SuiteIndex;
  collapsedIds: ReadonlySet<number>;
  selected: SuiteSelection;
  query?: string;
  favoriteSuiteIds?: number[];
  onSelect: (selection: SuiteSelection) => void;
  onToggleCollapsed: (suiteId: number) => void;
  onToggleFavorite?: (suiteId: number) => void;
};

type MindMapNodeData = {
  label: ReactNode;
  selection: SuiteSelection;
};

type MindMapNode = Node<MindMapNodeData>;

export default function MindMapView({
  index,
  collapsedIds,
  selected,
  query = "",
  favoriteSuiteIds = [],
  onSelect,
  onToggleCollapsed,
  onToggleFavorite,
}: MindMapViewProps) {
  const [instance, setInstance] = useState<ReactFlowInstance<MindMapNode, Edge> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const rows = useMemo(() => getVisibleSuiteRows(index, collapsedIds, query), [collapsedIds, index, query]);
  const matches = useMemo(() => matchingSuiteIds([...index.byId.values()], query), [index, query]);
  const selectedPath = useMemo(
    () => new Set(typeof selected === "number" ? getSuiteTrail(index, selected).map((suite) => suite.id) : []),
    [index, selected],
  );

  const { nodes, edges } = useMemo(() => {
    const rowById = new Map(rows.map((row) => [row.suite.id, row]));
    const flowNodes: MindMapNode[] = [];
    const flowEdges: Edge[] = [];
    const rootY = Math.max(40, ((rows.length - 1) * 108) / 2);

    flowNodes.push({
      id: "root",
      data: {
        selection: "root",
        label: (
          <div className="min-w-32 text-left">
            <div className="font-semibold">{REPOSITORY_ROOT_LABEL}</div>
            <div className="mt-1 text-xs text-slate-500">{index.roots.length} kořenových suit</div>
          </div>
        ),
      },
      position: { x: 20, y: rootY },
      style: nodeStyle(selected === "root", false, true),
      draggable: false,
      selectable: true,
    });

    rows.forEach(({ suite, depth, hasChildren }, rowIndex) => {
      const expanded = hasChildren && !collapsedIds.has(suite.id);
      const favorite = favoriteSuiteIds.includes(suite.id);
      const highlighted = matches.has(suite.id);
      flowNodes.push({
        id: String(suite.id),
        data: {
          selection: suite.id,
          label: (
            <div className="min-w-48 text-left">
              <div className="flex items-center gap-2">
                {hasChildren ? (
                  <button
                    aria-label={(expanded ? "Sbalit " : "Rozbalit ") + suite.name}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-slate-100"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleCollapsed(suite.id);
                    }}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : <span className="h-6 w-6" />}
                <span className="min-w-0 flex-1 truncate font-semibold">{suite.name}</span>
                {onToggleFavorite && (
                  <button
                    aria-label={favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
                    className={favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(suite.id);
                    }}
                  >
                    <Star fill={favorite ? "currentColor" : "none"} size={14} />
                  </button>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {suite.direct_test_case_count} přímo · {suite.total_test_case_count} celkem
                {!suite.is_active ? " · Neaktivní" : ""}
              </div>
            </div>
          ),
        },
        position: { x: 300 + depth * 300, y: rowIndex * 108 },
        style: nodeStyle(selected === suite.id, highlighted, suite.is_active),
        draggable: false,
        selectable: true,
      });

      const parentId = suite.parent_suite_id !== null && rowById.has(suite.parent_suite_id)
        ? String(suite.parent_suite_id)
        : "root";
      flowEdges.push({
        id: parentId + "-" + suite.id,
        source: parentId,
        target: String(suite.id),
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        style: {
          stroke: selectedPath.has(suite.id) ? "#0891b2" : "#cbd5e1",
          strokeWidth: selectedPath.has(suite.id) ? 2.5 : 1.5,
        },
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    collapsedIds,
    favoriteSuiteIds,
    index.roots.length,
    matches,
    onToggleCollapsed,
    onToggleFavorite,
    rows,
    selected,
    selectedPath,
  ]);

  useEffect(() => {
    if (!instance) return;
    const firstMatch = matches.values().next().value;
    const targetId = firstMatch !== undefined ? String(firstMatch) : typeof selected === "number" ? String(selected) : selected;
    if (!nodes.some((node) => node.id === targetId)) return;
    void instance.fitView({ nodes: [{ id: targetId }], duration: 300, padding: 1.5, maxZoom: 1.15 });
  }, [instance, matches, nodes, selected]);

  function handleNodeClick(_event: ReactMouseEvent, node: MindMapNode) {
    onSelect(node.data.selection);
  }

  return (
    <div className={fullscreen ? "fixed inset-4 z-50 rounded-md border border-slate-200 bg-white p-3 shadow-2xl" : "p-3"}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">Tažením posunujte plochu, kolečkem měňte přiblížení.</div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50" type="button" onClick={() => onSelect("root")}>
            <Home size={14} /> Kořen
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
            type="button"
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {fullscreen ? "Zavřít celou plochu" : "Celá plocha"}
          </button>
        </div>
      </div>
      <div className={fullscreen ? "h-[calc(100vh-7rem)] overflow-hidden rounded-md border border-slate-200" : "h-[560px] overflow-hidden rounded-md border border-slate-200"}>
        <ReactFlow<MindMapNode, Edge>
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          onInit={setInstance}
          onNodeClick={handleNodeClick}
          proOptions={{ hideAttribution: true }}
          aria-label="Myšlenková mapa test suit"
        >
          <Background color="#cbd5e1" gap={22} size={1} variant={BackgroundVariant.Dots} />
          <Controls showInteractive={false} aria-label="Ovládání myšlenkové mapy" />
        </ReactFlow>
      </div>
      <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Dostupný seznam uzlů</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ suite }) => (
            <button className="truncate rounded px-2 py-1 text-left text-cyan-700 hover:bg-white" key={suite.id} type="button" onClick={() => onSelect(suite.id)}>
              {suite.path}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function nodeStyle(selected: boolean, highlighted: boolean, active: boolean): React.CSSProperties {
  return {
    background: selected ? "#ecfeff" : highlighted ? "#fef9c3" : "#ffffff",
    border: "2px solid " + (selected ? "#0891b2" : highlighted ? "#eab308" : "#cbd5e1"),
    borderRadius: 8,
    boxShadow: selected ? "0 8px 24px rgba(8, 145, 178, 0.16)" : "0 3px 12px rgba(15, 23, 42, 0.08)",
    color: "#172033",
    opacity: active ? 1 : 0.58,
    padding: 12,
  };
}
