import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  active: boolean;
}

interface TenantContextType {
  currentTenantId: string | null;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  tenantRole: string | null;
  isGlobalSysadmin: boolean;
  isLoadingTenant: boolean;
  switchTenant: (tenantSlug: string) => void;
  tenantSlug: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, role, profile } = useAuth();
  const { tenantSlug: urlSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  const isGlobalSysadmin = role === 'sysadmin';

  const setTenantContext = useCallback(async (tenantId: string) => {
    const { error } = await supabase.rpc('set_tenant_context', { p_tenant_id: tenantId });
    if (error) {
      console.error('Failed to set tenant context:', error);
      throw error;
    }
  }, []);

  const selectTenant = useCallback(async (tenant: Tenant) => {
    // Set custom header so the pre-request function can set tenant context for every query
    // Must use .set() on the Headers Web API object, bracket notation doesn't work
    (supabase as any).rest.headers.set('x-tenant-id', tenant.id);
    
    await setTenantContext(tenant.id);
    setCurrentTenantId(tenant.id);
    setCurrentTenant(tenant);

    if (isGlobalSysadmin) {
      setTenantRole('sysadmin');
    } else {
      const { data } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user!.id)
        .single();
      setTenantRole(data?.role || null);
    }
  }, [user, isGlobalSysadmin, setTenantContext]);

  const switchTenant = useCallback((slug: string) => {
    navigate(`/${slug}/`);
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      setCurrentTenantId(null);
      setCurrentTenant(null);
      setTenants([]);
      setTenantRole(null);
      setIsLoadingTenant(false);
      return;
    }

    const loadTenants = async () => {
      setIsLoadingTenant(true);
      try {
        let availableTenants: Tenant[] = [];

        if (isGlobalSysadmin) {
          const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('active', true)
            .order('name');
          if (error) throw error;
          availableTenants = data || [];
        } else {
          const { data: memberships, error } = await supabase
            .from('tenant_members')
            .select('tenant_id, role')
            .eq('user_id', user.id);
          if (error) throw error;

          if (memberships && memberships.length > 0) {
            const tenantIds = memberships.map(m => m.tenant_id);
            const { data: tenantData, error: tenantError } = await supabase
              .from('tenants')
              .select('*')
              .in('id', tenantIds)
              .eq('active', true)
              .order('name');
            if (tenantError) throw tenantError;
            availableTenants = tenantData || [];
          }
        }

        setTenants(availableTenants);

        if (availableTenants.length > 0) {
          // Resolve tenant from URL slug
          let targetTenant: Tenant | undefined;

          if (urlSlug) {
            targetTenant = availableTenants.find(t => t.slug === urlSlug);
          }

          if (!targetTenant) {
            // Fallback: default tenant or first
            const defaultId = (profile as any)?.default_tenant_id;
            targetTenant = defaultId
              ? availableTenants.find(t => t.id === defaultId) || availableTenants[0]
              : availableTenants[0];

            // Redirect to correct slug URL
            if (targetTenant) {
              navigate(`/${targetTenant.slug}/`, { replace: true });
            }
          }

          if (targetTenant) {
            await selectTenant(targetTenant);
          }
        }
      } catch (err) {
        console.error('Failed to load tenants:', err);
      } finally {
        setIsLoadingTenant(false);
      }
    };

    loadTenants();
  }, [user, role, urlSlug]);

  return (
    <TenantContext.Provider value={{
      currentTenantId,
      currentTenant,
      tenants,
      tenantRole,
      isGlobalSysadmin,
      isLoadingTenant,
      switchTenant,
      tenantSlug: currentTenant?.slug || null,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
