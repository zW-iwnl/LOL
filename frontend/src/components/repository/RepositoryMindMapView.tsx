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
import { ChevronDown, ChevronRight, FileText, FolderPlus, Home, Maximize2, Minimize2, Plus, Star } from "lucide-react";
import type { TestCase } from "../../api/client";
import { getSuiteTrail, REPOSITORY_ROOT_LABEL, type SuiteSelection } from "../test-suites/suiteTree";
import { getRepositorySections } from "./repositoryModel";
import type { RepositoryViewProps } from "./repositoryTypes";

const DEFAULT_CASE_LIMIT = 30;

type RepositoryMapNodeData = {
  kind: "root" | "suite" | "test-case" | "more";
  label: ReactNode;
  selection?: SuiteSelection;
  testCase?: TestCase;
};

type RepositoryMapNode = Node<RepositoryMapNodeData>;

export default function RepositoryMindMapView(props: RepositoryViewProps) {
  const [expandedCaseGroups, setExpandedCaseGroups] = useState<Set<string>>(new Set());
  const [instance, setInstance] = useState<ReactFlowInstance<RepositoryMapNode, Edge> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const sections = useMemo(
    () => getRepositorySections(props.model, props.collapsedIds, props.query),
    [props.collapsedIds, props.model, props.query],
  );
  const selectedPath = useMemo(
    () => new Set(typeof props.selected === "number" ? getSuiteTrail(props.model.suiteIndex, props.selected).map((suite) => suite.id) : []),
    [props.model.suiteIndex, props.selected],
  );

  const { nodes, edges } = useMemo(() => {
    const flowNodes: RepositoryMapNode[] = [];
    const flowEdges: Edge[] = [];
    const visibleSuiteIds = new Set(sections.flatMap((section) => section.suite ? [section.suite.id] : []));
    let cursorY = 20;

    for (const section of sections.filter((item) => item.selection !== "root")) {
      const suite = section.suite!;
      const hasContent = section.hasChildren || section.testCases.length > 0;
      const expanded = hasContent && !props.collapsedIds.has(suite.id);
      const favorite = props.favoriteSuiteIds.includes(suite.id);
      flowNodes.push({
        id: suiteNodeId(suite.id),
        data: {
          kind: "suite",
          selection: suite.id,
          label: (
            <div className="min-w-48 text-left">
              <div className="flex items-center gap-2">
                {hasContent ? (
                  <button
                    aria-label={(expanded ? "Sbalit " : "Rozbalit ") + suite.name}
                    className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onToggleCollapsed(suite.id);
                    }}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : <span className="h-6 w-6" />}
                <span className="min-w-0 flex-1 truncate font-semibold">{suite.name}</span>
                <button
                  className="text-cyan-700 hover:text-cyan-900"
                  title="Nový test case"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onCreateTestCase(suite.id);
                  }}
                >
                  <Plus size={14} />
                </button>
                <button
                  className="text-slate-600 hover:text-slate-900"
                  title="Nová podsuita"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onCreateSuite(suite.id);
                  }}
                >
                  <FolderPlus size={14} />
                </button>
                <button
                  className={favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}
                  title={favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onToggleFavorite(suite.id);
                  }}
                >
                  <Star fill={favorite ? "currentColor" : "none"} size={14} />
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">{section.testCases.length} přímých test cases</div>
            </div>
          ),
        },
        position: { x: 300 + (section.depth - 1) * 290, y: cursorY },
        style: suiteNodeStyle(props.selected === suite.id, suite.is_active),
        draggable: false,
      });
      cursorY += 92;

      const parentId = suite.parent_suite_id !== null && visibleSuiteIds.has(suite.parent_suite_id)
        ? suiteNodeId(suite.parent_suite_id)
        : "root";
      flowEdges.push(edge(parentId, suiteNodeId(suite.id), selectedPath.has(suite.id)));

      if (expanded) {
        cursorY = appendCaseNodes({
          cases: section.testCases,
          parentId: suiteNodeId(suite.id),
          parentDepth: section.depth,
          cursorY,
          groupKey: String(suite.id),
          expandedCaseGroups,
          flowNodes,
          flowEdges,
          onExpand: expandCaseGroup,
        });
      }
    }

    const rootSection = sections.find((section) => section.selection === "root")!;
    cursorY = appendCaseNodes({
      cases: rootSection.testCases,
      parentId: "root",
      parentDepth: 0,
      cursorY,
      groupKey: "root",
      expandedCaseGroups,
      flowNodes,
      flowEdges,
      onExpand: expandCaseGroup,
    });

    flowNodes.unshift({
      id: "root",
      data: {
        kind: "root",
        selection: "root",
        label: (
          <div className="min-w-40 text-left">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-semibold">{REPOSITORY_ROOT_LABEL}</span>
              <button
                className="text-cyan-700"
                title="Nový test case"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onCreateTestCase("root");
                }}
              >
                <Plus size={14} />
              </button>
              <button
                className="text-slate-600"
                title="Nová suita"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onCreateSuite("root");
                }}
              >
                <FolderPlus size={14} />
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">{rootSection.testCases.length} přímých test cases</div>
          </div>
        ),
      },
      position: { x: 20, y: Math.max(20, cursorY / 2 - 40) },
      style: suiteNodeStyle(props.selected === "root", true),
      draggable: false,
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [expandedCaseGroups, props, sections, selectedPath]);

  function expandCaseGroup(groupKey: string) {
    setExpandedCaseGroups((current) => new Set(current).add(groupKey));
  }

  function handleNodeClick(_event: ReactMouseEvent, node: RepositoryMapNode) {
    if (node.data.kind === "test-case" && node.data.testCase) {
      props.onOpenCase(node.data.testCase);
    } else if ((node.data.kind === "root" || node.data.kind === "suite") && node.data.selection !== undefined) {
      props.onSelectSuite(node.data.selection);
    }
  }

  useEffect(() => {
    if (!instance) return;
    const targetId = props.selected === "root" ? "root" : suiteNodeId(props.selected);
    if (!nodes.some((node) => node.id === targetId)) return;
    void instance.fitView({ nodes: [{ id: targetId }], duration: 300, padding: 1.4, maxZoom: 1.1 });
  }, [instance, nodes, props.selected]);

  return (
    <div className={fullscreen ? "fixed inset-4 z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl" : "relative"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-xs text-slate-500">Tažením posunujte plochu, kolečkem měňte přiblížení.</span>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
            type="button"
            onClick={() => {
              props.onSelectSuite("root");
              void instance?.fitView({ nodes: [{ id: "root" }], duration: 300, padding: 1.4, maxZoom: 1.1 });
            }}
          >
            <Home size={14} /> {REPOSITORY_ROOT_LABEL}
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

      {props.createForm && (
        <div className="border-b border-slate-200 bg-white">{props.createForm}</div>
      )}
      <div className={fullscreen ? "h-[calc(100vh-8rem)] overflow-hidden bg-slate-50" : "h-[680px] overflow-hidden bg-slate-50"}>
        <ReactFlow<RepositoryMapNode, Edge>
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.7}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          onInit={setInstance}
          onNodeClick={handleNodeClick}
          proOptions={{ hideAttribution: true }}
          aria-label="Myšlenková mapa Repository"
        >
          <Background color="#cbd5e1" gap={22} size={1} variant={BackgroundVariant.Dots} />
          <Controls showInteractive={false} aria-label="Ovládání myšlenkové mapy" />
        </ReactFlow>
      </div>
      <details className="border-t border-slate-200 bg-white px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Dostupný seznam uzlů</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.filter((node) => node.data.kind !== "more").map((node) => (
            <button className="truncate rounded px-2 py-1 text-left text-cyan-700 hover:bg-slate-50" key={node.id} type="button" onClick={() => handleNodeClick({} as ReactMouseEvent, node)}>
              {node.data.kind === "test-case" ? node.data.testCase?.code + " · " + node.data.testCase?.title : node.data.selection === "root" ? REPOSITORY_ROOT_LABEL : props.model.suiteIndex.byId.get(node.data.selection as number)?.path}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function appendCaseNodes({
  cases,
  parentId,
  parentDepth,
  cursorY,
  groupKey,
  expandedCaseGroups,
  flowNodes,
  flowEdges,
  onExpand,
}: {
  cases: TestCase[];
  parentId: string;
  parentDepth: number;
  cursorY: number;
  groupKey: string;
  expandedCaseGroups: ReadonlySet<string>;
  flowNodes: RepositoryMapNode[];
  flowEdges: Edge[];
  onExpand: (groupKey: string) => void;
}): number {
  const expanded = expandedCaseGroups.has(groupKey);
  const visibleCases = expanded ? cases : cases.slice(0, DEFAULT_CASE_LIMIT);

  for (const testCase of visibleCases) {
    const nodeId = caseNodeId(testCase.id);
    flowNodes.push({
      id: nodeId,
      data: {
        kind: "test-case",
        testCase,
        label: (
          <div className="flex min-w-48 items-center gap-2 text-left">
            <FileText className="shrink-0 text-cyan-700" size={15} />
            <span className="font-medium text-cyan-700">{testCase.code}</span>
            <span className="truncate text-slate-700">{testCase.title}</span>
          </div>
        ),
      },
      position: { x: 300 + parentDepth * 290, y: cursorY },
      style: caseNodeStyle(),
      draggable: false,
    });
    flowEdges.push(edge(parentId, nodeId, false));
    cursorY += 68;
  }

  if (!expanded && cases.length > DEFAULT_CASE_LIMIT) {
    const remaining = cases.length - DEFAULT_CASE_LIMIT;
    const nodeId = `more-${groupKey}`;
    flowNodes.push({
      id: nodeId,
      data: {
        kind: "more",
        label: (
          <button className="font-medium text-cyan-700" type="button" onClick={(event) => { event.stopPropagation(); onExpand(groupKey); }}>
            Dalších {remaining} test cases
          </button>
        ),
      },
      position: { x: 300 + parentDepth * 290, y: cursorY },
      style: caseNodeStyle(),
      draggable: false,
    });
    flowEdges.push(edge(parentId, nodeId, false));
    cursorY += 68;
  }

  return cursorY;
}

function edge(source: string, target: string, highlighted: boolean): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13 },
    style: { stroke: highlighted ? "#0891b2" : "#94a3b8", strokeWidth: highlighted ? 2.4 : 1.4 },
  };
}

function suiteNodeId(id: number): string {
  return `suite-${id}`;
}

function caseNodeId(id: number): string {
  return `case-${id}`;
}

function suiteNodeStyle(selected: boolean, active: boolean): React.CSSProperties {
  return {
    background: selected ? "#ecfeff" : "#ffffff",
    border: "2px solid " + (selected ? "#0891b2" : "#cbd5e1"),
    borderRadius: 8,
    boxShadow: "0 3px 12px rgba(15, 23, 42, 0.08)",
    color: "#172033",
    opacity: active ? 1 : 0.58,
    padding: 10,
  };
}

function caseNodeStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    color: "#172033",
    padding: "8px 10px",
  };
}
