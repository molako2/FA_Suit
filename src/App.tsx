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
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import DashboardCharts from "./pages/DashboardCharts";
import Timesheet from "./pages/Timesheet";
 import Expenses from "./pages/Expenses";
import Clients from "./pages/Clients";
import Matters from "./pages/Matters";
import Collaborators from "./pages/Collaborators";
import Invoices from "./pages/Invoices";
import CreditNotes from "./pages/CreditNotes";
import Purchases from "./pages/Purchases";
import Settings from "./pages/Settings";
import Todos from "./pages/Todos";
import Messages from "./pages/Messages";
import Documents from "./pages/Documents";
import Agenda from "./pages/Agenda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role } = useAuth();

  // Redirect based on role for root path
  const getHomeRoute = () => {
    if (!user) return <Navigate to="/login" replace />;
    if (role === 'owner' || role === 'sysadmin') return <Dashboard />;
    if (role === 'client') return <Navigate to="/documents" replace />;
    return <Navigate to="/timesheet" replace />;
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>{getHomeRoute()}</AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/dashboard-charts"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner']}>
            <AppLayout><DashboardCharts /></AppLayout>
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
         path="/expenses"
         element={
           <ProtectedRoute>
             <AppLayout><Expenses /></AppLayout>
           </ProtectedRoute>
         }
       />
       
      <Route
        path="/clients"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner', 'assistant']}>
            <AppLayout><Clients /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/matters"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner', 'assistant']}>
            <AppLayout><Matters /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/collaborators"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner']}>
            <AppLayout><Collaborators /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/invoices"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner', 'assistant']}>
            <AppLayout><Invoices /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/credit-notes"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner', 'assistant']}>
            <AppLayout><CreditNotes /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/purchases"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner', 'assistant']}>
            <AppLayout><Purchases /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/todos"
        element={
          <ProtectedRoute>
            <AppLayout><Todos /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <AppLayout><Messages /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/agenda"
        element={
          <ProtectedRoute>
            <AppLayout><Agenda /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/documents"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner', 'assistant', 'client']}>
            <AppLayout><Documents /></AppLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['sysadmin', 'owner']}>
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
