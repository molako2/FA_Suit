import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FileText,
  FileMinus2,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  FolderOpen,
  Receipt,
  Clock,
  ShoppingCart,
  CheckSquare,
  MessageSquare,
} from 'lucide-react';
import { usePendingTodosCount, useInProgressTodosCount, useBlockedTodosCount } from '@/hooks/useTodos';
import { useUnreadMessagesCount } from '@/hooks/useMessages';
  import appLogo from '@/assets/flowassist-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavItemConfig {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('sysadmin' | 'owner' | 'assistant' | 'collaborator')[];
}

const navItemsConfig: NavItemConfig[] = [
  {
    labelKey: 'nav.dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['sysadmin', 'owner'],
  },
  {
    labelKey: 'nav.timesheet',
    href: '/timesheet',
    icon: Clock,
    roles: ['sysadmin', 'owner', 'assistant', 'collaborator'],
  },
   {
     labelKey: 'nav.expenses',
     href: '/expenses',
     icon: Receipt,
     roles: ['sysadmin', 'owner', 'assistant', 'collaborator'],
   },
  {
    labelKey: 'nav.clients',
    href: '/clients',
    icon: Building2,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    labelKey: 'nav.matters',
    href: '/matters',
    icon: FolderOpen,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    labelKey: 'nav.collaborators',
    href: '/collaborators',
    icon: Users,
    roles: ['sysadmin', 'owner'],
  },
  {
    labelKey: 'nav.invoices',
    href: '/invoices',
    icon: FileText,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    labelKey: 'nav.creditNotes',
    href: '/credit-notes',
    icon: FileMinus2,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    labelKey: 'nav.purchases',
    href: '/purchases',
    icon: ShoppingCart,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    labelKey: 'nav.todos',
    href: '/todos',
    icon: CheckSquare,
    roles: ['sysadmin', 'owner', 'assistant', 'collaborator'],
  },
  {
    labelKey: 'nav.messages',
    href: '/messages',
    icon: MessageSquare,
    roles: ['sysadmin', 'owner', 'assistant', 'collaborator'],
  },
  {
    labelKey: 'nav.settings',
    href: '/settings',
    icon: Settings,
    roles: ['sysadmin', 'owner'],
  },
];

const roleColors = {
  sysadmin: 'bg-destructive text-destructive-foreground',
  owner: 'bg-accent text-accent-foreground',
  assistant: 'bg-primary text-primary-foreground',
  collaborator: 'bg-secondary text-secondary-foreground',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, profile, role, signOut } = useAuth();
  const location = useLocation();

  const showPendingBadge = role === 'collaborator' || role === 'assistant';
  const showBlockedBadge = role === 'owner' || role === 'sysadmin';
  const { data: pendingCount } = usePendingTodosCount(showPendingBadge ? user?.id : undefined);
  const { data: inProgressCount } = useInProgressTodosCount(showPendingBadge ? user?.id : undefined);
  const { data: blockedCount } = useBlockedTodosCount(showBlockedBadge);
  const { data: unreadMessagesCount } = useUnreadMessagesCount(user?.id);

  if (!user || !role) return null;

  const filteredNavItems = navItemsConfig.filter(item => item.roles.includes(role));
  const displayName = profile?.name || user.email?.split('@')[0] || t('common.user');

  const roleLabels: Record<string, string> = {
    sysadmin: t('collaborators.sysadmin'),
    owner: t('collaborators.owner'),
    assistant: t('collaborators.assistant'),
    collaborator: t('collaborators.collaborator'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden p-1">
              <img src={appLogo} alt="FlowAssist" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-lg">FlowAssist</span>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              const showRedBadge = (item.href === '/todos' && (
                (showPendingBadge && pendingCount && pendingCount > 0) ||
                (showBlockedBadge && blockedCount && blockedCount > 0)
              )) || (item.href === '/messages' && unreadMessagesCount && unreadMessagesCount > 0);
              const redBadgeCount = item.href === '/messages' 
                ? unreadMessagesCount 
                : (showPendingBadge ? pendingCount : blockedCount);
              const showGreenBadge = item.href === '/todos' && showPendingBadge && inProgressCount && inProgressCount > 0;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors relative',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {t(item.labelKey)}
                  {showRedBadge && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-destructive rounded-full">
                      {redBadgeCount}
                    </span>
                  )}
                  {showGreenBadge && (
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-green-500 rounded-full">
                      {inProgressCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium">{displayName}</p>
                  <Badge className={cn('text-xs', roleColors[role])}>
                    {roleLabels[role]}
                  </Badge>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="flex justify-around py-2">
          {filteredNavItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            const showRedBadgeMobile = (item.href === '/todos' && (
              (showPendingBadge && pendingCount && pendingCount > 0) ||
              (showBlockedBadge && blockedCount && blockedCount > 0)
            )) || (item.href === '/messages' && unreadMessagesCount && unreadMessagesCount > 0);
            const redBadgeCountMobile = item.href === '/messages'
              ? unreadMessagesCount
              : (showPendingBadge ? pendingCount : blockedCount);
            const showGreenBadgeMobile = item.href === '/todos' && showPendingBadge && inProgressCount && inProgressCount > 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center p-2 text-xs relative',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-1" />
                  {showRedBadgeMobile && (
                    <span className="absolute -top-1 -right-2 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-destructive rounded-full">
                      {redBadgeCountMobile}
                    </span>
                  )}
                  {showGreenBadgeMobile && (
                    <span className="absolute -top-1 -right-6 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-green-500 rounded-full">
                      {inProgressCount}
                    </span>
                  )}
                </div>
                  {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
