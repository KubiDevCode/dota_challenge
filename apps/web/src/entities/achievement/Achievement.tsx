import type { LucideIcon } from 'lucide-react'

export function Achievement({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active?: boolean }) { return <div className={`achievement ${active ? 'active' : ''}`}><Icon size={19} /><span>{label}</span></div> }
