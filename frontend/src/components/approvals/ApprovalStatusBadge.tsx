export const approvalLabels: Record<string, string> = {
  pending: "Ke schválení", approved: "Schváleno", changes_requested: "K dopracování",
  rejected: "Zamítnuto", withdrawn: "Staženo", unsubmitted: "Neschválený návrh",
  legacy_import: "Převzato z původního systému", unknown: "Schválení není doloženo",
  legacy_snapshot_missing: "Historický snapshot chybí", open: "Rozpracováno", submitted: "Odesláno", closed: "Uzavřeno",
};
export function ApprovalStatusBadge({ state }: { state: string | null | undefined }) {
  return <span className={`inline-block rounded-md px-2 py-1 text-xs ${state === "approved" ? "bg-emerald-50 text-emerald-800" : state === "rejected" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>{approvalLabels[state ?? "unknown"] ?? state}</span>;
}
