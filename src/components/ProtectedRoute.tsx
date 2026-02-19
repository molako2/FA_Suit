import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import type { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { tenantRole, isLoadingTenant, isGlobalSysadmin, tenantSlug } = useTenant();
  const location = useLocation();

  if (isLoading || isLoadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const effectiveRole = (isGlobalSysadmin ? 'sysadmin' : tenantRole) as UserRole | null;

  if (allowedRoles) {
    if (!effectiveRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!allowedRoles.includes(effectiveRole)) {
      const slug = tenantSlug || '';
      const homeRoute = effectiveRole === 'client'
        ? `/${slug}/documents`
        : effectiveRole === 'collaborator'
          ? `/${slug}/timesheet`
          : `/${slug}/`;
      return <Navigate to={homeRoute} replace />;
    }
  }

  return <>{children}</>;
}
