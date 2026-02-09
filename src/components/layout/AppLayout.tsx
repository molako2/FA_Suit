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
  ChevronUp,
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
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

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

  const getRedBadgeCount = (href: string) => {
    if (href === '/messages') return unreadMessagesCount;
    if (href === '/todos') return showPendingBadge ? pendingCount : blockedCount;
    return 0;
  };

  const hasRedBadge = (href: string) => {
    if (href === '/messages') return unreadMessagesCount && unreadMessagesCount > 0;
    if (href === '/todos') {
      return (showPendingBadge && pendingCount && pendingCount > 0) ||
        (showBlockedBadge && blockedCount && blockedCount > 0);
    }
    return false;
  };

  const hasGreenBadge = (href: string) => {
    return href === '/todos' && showPendingBadge && inProgressCount && inProgressCount > 0;
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        {/* Sidebar Header - Logo */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="FlowAssist">
                <Link to="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background border border-border overflow-hidden p-0.5">
                    <img src={appLogo} alt="FlowAssist" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-semibold text-lg">FlowAssist</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Sidebar Content - Navigation */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  const redBadge = hasRedBadge(item.href);
                  const greenBadge = hasGreenBadge(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={t(item.labelKey)}
                      >
                        <Link to={item.href}>
                          <Icon className="shrink-0" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                      {redBadge && (
                        <SidebarMenuBadge className="bg-destructive text-destructive-foreground rounded-full text-[10px] min-w-4 h-4 px-1">
                          {getRedBadgeCount(item.href)}
                        </SidebarMenuBadge>
                      )}
                      {greenBadge && !redBadge && (
                        <SidebarMenuBadge className="bg-accent text-accent-foreground rounded-full text-[10px] min-w-4 h-4 px-1">
                          {inProgressCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar Footer - User Menu */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={displayName}
                  >
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-medium text-primary">
                        {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{displayName}</span>
                      <Badge className={cn('text-[10px] w-fit', roleColors[role])}>
                        {roleLabels[role]}
                      </Badge>
                    </div>
                    <ChevronUp className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-sm font-medium text-primary">
                          {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('auth.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex-1 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
