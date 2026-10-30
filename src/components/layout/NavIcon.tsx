import {
  Activity,
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Compass,
  FileChartColumn,
  FolderKanban,
  FolderOpen,
  LayoutGrid,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { type IconName } from "../../lib/nav";

// Task 18 (2026-10-30): sidebar icons are lucide-react components, same keys as before
const MAP: Record<IconName, LucideIcon> = {
  grid: LayoutGrid,
  folder: FolderKanban,
  calendar: CalendarDays,
  users: Users,
  wallet: Wallet,
  trending: TrendingUp,
  receipt: Receipt,
  shield: ShieldCheck,
  file: FolderOpen,
  book: BookOpen,
  activity: Activity,
  alert: TriangleAlert,
  chart: ChartColumn,
  compass: Compass,
  userCog: UserCog,
  clipboard: ClipboardList,
  settings: Settings,
  cart: ShoppingCart,
  sync: RefreshCw,
  team: UsersRound,
  reports: FileChartColumn,
};

export function NavIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Icon = MAP[name];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}
