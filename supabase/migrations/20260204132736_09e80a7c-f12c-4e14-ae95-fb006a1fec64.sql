-- 1. Enum for roles
CREATE TYPE public.app_role AS ENUM ('owner', 'assistant', 'collaborator');

-- 2. User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    rate_cents INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    billing_email TEXT,
    vat_number TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 5. Matters table
CREATE TABLE public.matters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    rate_cents INTEGER,
    vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;

-- 6. Assignments table
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (matter_id, user_id)
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 7. Timesheet entries table
CREATE TABLE public.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    minutes_rounded INTEGER NOT NULL,
    description TEXT NOT NULL,
    billable BOOLEAN NOT NULL DEFAULT true,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

-- 8. Invoices table
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT UNIQUE,
    matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    issue_date DATE,
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_ht_cents INTEGER NOT NULL DEFAULT 0,
    total_vat_cents INTEGER NOT NULL DEFAULT 0,
    total_ttc_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 9. Credit notes table
CREATE TABLE public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL UNIQUE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    issue_date DATE NOT NULL,
    reason TEXT,
    total_ht_cents INTEGER NOT NULL,
    total_vat_cents INTEGER NOT NULL,
    total_ttc_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- 10. Cabinet settings table
CREATE TABLE public.cabinet_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL DEFAULT 'Mon Cabinet',
    address TEXT,
    iban TEXT,
    mentions TEXT,
    rate_cabinet_cents INTEGER NOT NULL DEFAULT 15000,
    vat_default NUMERIC(5,2) NOT NULL DEFAULT 20,
    invoice_seq_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
    invoice_seq_next INTEGER NOT NULL DEFAULT 1,
    credit_seq_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
    credit_seq_next INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cabinet_settings ENABLE ROW LEVEL SECURITY;

-- 11. Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 12. Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 13. Helper function: is_owner_or_assistant
CREATE OR REPLACE FUNCTION public.is_owner_or_assistant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'assistant')
  )
$$;

-- 14. Helper function: is_owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'
  )
$$;

-- 15. Helper function: user_is_assigned_to_matter
CREATE OR REPLACE FUNCTION public.user_is_assigned_to_matter(_matter_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments
    WHERE matter_id = _matter_id 
      AND user_id = auth.uid()
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  )
$$;

-- RLS Policies

-- user_roles: only owners can manage roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "Only owners can insert roles" ON public.user_roles
    FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY "Only owners can update roles" ON public.user_roles
    FOR UPDATE USING (public.is_owner());
CREATE POLICY "Only owners can delete roles" ON public.user_roles
    FOR DELETE USING (public.is_owner());

-- profiles: all authenticated can view, only owners can modify others
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid() OR public.is_owner());
CREATE POLICY "Owners can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid() OR public.is_owner());

-- clients: owners/assistants full access, collaborators read only
CREATE POLICY "View clients" ON public.clients
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage clients" ON public.clients
    FOR ALL USING (public.is_owner_or_assistant());

-- matters: owners/assistants full access, collaborators see assigned matters
CREATE POLICY "View matters" ON public.matters
    FOR SELECT USING (
      public.is_owner_or_assistant() OR public.user_is_assigned_to_matter(id)
    );
CREATE POLICY "Manage matters" ON public.matters
    FOR ALL USING (public.is_owner_or_assistant());

-- assignments: owners/assistants full access, collaborators see own
CREATE POLICY "View assignments" ON public.assignments
    FOR SELECT USING (
      public.is_owner_or_assistant() OR user_id = auth.uid()
    );
CREATE POLICY "Manage assignments" ON public.assignments
    FOR ALL USING (public.is_owner_or_assistant());

-- timesheet_entries: owners/assistants full access, collaborators own entries
CREATE POLICY "View timesheet entries" ON public.timesheet_entries
    FOR SELECT USING (
      public.is_owner_or_assistant() OR user_id = auth.uid()
    );
CREATE POLICY "Users manage own timesheet" ON public.timesheet_entries
    FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_owner_or_assistant());
CREATE POLICY "Users update own timesheet" ON public.timesheet_entries
    FOR UPDATE USING (
      (user_id = auth.uid() AND NOT locked) OR public.is_owner_or_assistant()
    );
CREATE POLICY "Users delete own timesheet" ON public.timesheet_entries
    FOR DELETE USING (
      (user_id = auth.uid() AND NOT locked) OR public.is_owner_or_assistant()
    );

-- invoices: owners/assistants full access, collaborators read only
CREATE POLICY "View invoices" ON public.invoices
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage invoices" ON public.invoices
    FOR ALL USING (public.is_owner_or_assistant());

-- credit_notes: owners/assistants full access, collaborators read only
CREATE POLICY "View credit notes" ON public.credit_notes
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage credit notes" ON public.credit_notes
    FOR ALL USING (public.is_owner_or_assistant());

-- cabinet_settings: owners full access, others read only
CREATE POLICY "View cabinet settings" ON public.cabinet_settings
    FOR SELECT USING (public.is_owner_or_assistant());
CREATE POLICY "Manage cabinet settings" ON public.cabinet_settings
    FOR ALL USING (public.is_owner());

-- audit_logs: owners/assistants can view and create
CREATE POLICY "View audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_owner_or_assistant());
CREATE POLICY "Create audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matters_updated_at BEFORE UPDATE ON public.matters
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_timesheet_entries_updated_at BEFORE UPDATE ON public.timesheet_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cabinet_settings_updated_at BEFORE UPDATE ON public.cabinet_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default cabinet settings
INSERT INTO public.cabinet_settings (id, name, rate_cabinet_cents)
VALUES ('default', 'Mon Cabinet', 15000)
ON CONFLICT (id) DO NOTHING;