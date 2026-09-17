import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookMarked,
  Calendar,
  Compass,
  FileText,
  FolderKanban,
  LayoutGrid,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  ClipboardList,
  TrendingUp,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";
import { type IconName } from "../../lib/nav";

const MAP = {
  grid: LayoutGrid,
  folder: FolderKanban,
  calendar: Calendar,
  users: Users,
  wallet: Wallet,
  trending: TrendingUp,
  receipt: Receipt,
  shield: ShieldCheck,
  file: FileText,
  book: BookMarked,
  activity: Activity,
  alert: AlertTriangle,
  chart: BarChart3,
  compass: Compass,
  userCog: UserCog,
  clipboard: ClipboardList,
  settings: Settings,
  cart: ShoppingCart,
} satisfies Record<IconName, ComponentType<{ className?: string }>>;

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const Cmp = MAP[name];
  return <Cmp className={className} aria-hidden="true" />;
}