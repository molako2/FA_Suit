import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
 import appLogo from '@/assets/logo.png';
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

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('sysadmin' | 'owner' | 'assistant' | 'collaborator')[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['sysadmin', 'owner'],
  },
  {
    label: 'Mes temps',
    href: '/timesheet',
    icon: Clock,
    roles: ['sysadmin', 'owner', 'assistant', 'collaborator'],
  },
   {
     label: 'Mes frais',
     href: '/expenses',
     icon: Receipt,
     roles: ['sysadmin', 'owner', 'assistant', 'collaborator'],
   },
  {
    label: 'Clients',
    href: '/clients',
    icon: Building2,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    label: 'Dossiers',
    href: '/matters',
    icon: FolderOpen,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    label: 'Collaborateurs',
    href: '/collaborators',
    icon: Users,
    roles: ['sysadmin', 'owner'],
  },
  {
    label: 'Factures',
    href: '/invoices',
    icon: FileText,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    label: 'Avoirs',
    href: '/credit-notes',
    icon: FileMinus2,
    roles: ['sysadmin', 'owner', 'assistant'],
  },
  {
    label: 'Paramètres',
    href: '/settings',
    icon: Settings,
    roles: ['sysadmin', 'owner'],
  },
];

const roleLabels = {
  sysadmin: 'Sysadmin',
  owner: 'Associé',
  assistant: 'Assistant',
  collaborator: 'Collaborateur',
};

const roleColors = {
  sysadmin: 'bg-destructive text-destructive-foreground',
  owner: 'bg-accent text-accent-foreground',
  assistant: 'bg-primary text-primary-foreground',
  collaborator: 'bg-secondary text-secondary-foreground',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, role, signOut } = useAuth();
  const location = useLocation();

  if (!user || !role) return null;

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));
  const displayName = profile?.name || user.email?.split('@')[0] || 'Utilisateur';

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
              <img src={appLogo} alt="FlowAssist" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-semibold text-lg">FlowAssist</span>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
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
                Déconnexion
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
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center p-2 text-xs',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5 mb-1" />
                {item.label}
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
