import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";  // Import your admin dashboard
import Project from "./pages/Project";
import EnGenieChat from "./pages/EnGenieChat";  // EnGenie Chat page
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import React from "react";
import Uploading from "./pages/Uploading";

const queryClient = new QueryClient();

// Enhanced ProtectedRoute to allow optional admin-only access
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    // Render a loading state while auth info is loading
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requireAdmin && user?.role !== "admin") {
    // Redirect non-admins away from admin routes (you can customize the path)
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected requirements route */}
            <Route
              path="/project"
              element={
                <ProtectedRoute>
                  <Project />
                </ProtectedRoute>
              }
            />

            {/* Protected EnGenie Chat route */}
            <Route
              path="/engenie-chat"
              element={
                <ProtectedRoute>
                  <EnGenieChat />
                </ProtectedRoute>
              }
            />

            {/* Protected dashboard route */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />

            {/* Protected admin route */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/upload"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Uploading />
                </ProtectedRoute>
              }
            />


            {/* Catch-all for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
