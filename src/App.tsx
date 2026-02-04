import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Timesheet from "./pages/Timesheet";
import Clients from "./pages/Clients";
import Matters from "./pages/Matters";
import Collaborators from "./pages/Collaborators";
import Invoices from "./pages/Invoices";
import CreditNotes from "./pages/CreditNotes";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user } = useAuth();

  // Redirect based on role for root path
  const getHomeRoute = () => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role === 'owner') return <Dashboard />;
    return <Navigate to="/timesheet" replace />;
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>{getHomeRoute()}</AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/timesheet"
        element={
          <ProtectedRoute>
            <AppLayout><Timesheet /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/clients"
        element={
          <ProtectedRoute allowedRoles={['owner', 'assistant']}>
            <AppLayout><Clients /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/matters"
        element={
          <ProtectedRoute allowedRoles={['owner', 'assistant']}>
            <AppLayout><Matters /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/collaborators"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <AppLayout><Collaborators /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/invoices"
        element={
          <ProtectedRoute allowedRoles={['owner', 'assistant']}>
            <AppLayout><Invoices /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/credit-notes"
        element={
          <ProtectedRoute allowedRoles={['owner', 'assistant']}>
            <AppLayout><CreditNotes /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <AppLayout><Settings /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
