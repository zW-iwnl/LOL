import type { InputHTMLAttributes } from "react";

export function RunField({ label, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input {...input} className="workspace-input w-full" /></label>;
}
