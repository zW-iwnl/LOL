// Only application paths are accepted; never navigate to a supplied external URL.
export function safeReturn(value: string | null | undefined, fallback: string) { return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback; }
export function withReturn(path: string, returnTo: string) { return `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`; }
