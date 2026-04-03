import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Layouts
import ClientLayout from "@/layouts/ClientLayout";
import ClientPortalLayout from "@/layouts/ClientPortalLayout";
import TherapistLayout from "@/layouts/TherapistLayout";
import AdminLayout from "@/layouts/AdminLayout";

// Public pages
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ForTherapists from "@/pages/ForTherapists";
import HowItWorks from "@/pages/HowItWorks";
import NotFound from "@/pages/NotFound";
import AuthRedirect from "@/pages/AuthRedirect";
import Blog, { BlogPost } from "@/pages/Blog";
import Terms from "@/pages/Terms";
import AboutUs from "@/pages/AboutUs";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Resources from "@/pages/Resources";

// Client pages
import ClientDashboard from "@/pages/ClientDashboard";
import ClientSettings from "@/pages/ClientSettings";
import Questionnaire from "@/pages/Questionnaire";
import Matches from "@/pages/Matches";
import TherapistProfile from "@/pages/TherapistProfile";
import BookSession from "@/pages/BookSession";

// Therapist pages
import TherapistDashboard from "@/pages/therapist/TherapistDashboard";
import TherapistCalendar from "@/pages/therapist/TherapistCalendar";
import TherapistClients from "@/pages/therapist/TherapistClients";
import TherapistEarnings from "@/pages/therapist/TherapistEarnings";
import TherapistProfileEdit from "@/pages/therapist/TherapistProfileEdit";
import TherapistOnboarding from "@/pages/therapist/TherapistOnboarding";

// Admin pages
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminTherapists from "@/pages/admin/AdminTherapists";
import AdminClients from "@/pages/admin/AdminClients";
import AdminSessions from "@/pages/admin/AdminSessions";
import AdminFinance from "@/pages/admin/AdminFinance";
import AdminContent from "@/pages/admin/AdminContent";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminSettings from "@/pages/admin/AdminSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes — landing page with navbar + footer */}
            <Route element={<ClientLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/for-therapists" element={<ForTherapists />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/resources" element={<Resources />} />
            </Route>

            {/* Client portal — clean header, no footer, no "For Therapists" */}
            <Route element={
              <ProtectedRoute requiredRole="client"><ClientPortalLayout /></ProtectedRoute>
            }>
              <Route path="/dashboard" element={<ClientDashboard />} />
              <Route path="/settings" element={<ClientSettings />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/therapist/:id" element={<TherapistProfile />} />
              <Route path="/book/:id" element={<BookSession />} />
            </Route>

            {/* Questionnaire (focused flow, no navbar) */}
            <Route path="/questionnaire" element={<Questionnaire />} />

            {/* Auth pages (no layout) */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth-redirect" element={<AuthRedirect />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            {/* Therapist onboarding (no sidebar layout) */}
            <Route path="/therapist-portal/onboarding" element={<TherapistOnboarding />} />

            {/* Therapist portal */}
            <Route element={
              <ProtectedRoute requiredRole="therapist"><TherapistLayout /></ProtectedRoute>
            }>
              <Route path="/therapist-portal" element={<TherapistDashboard />} />
              <Route path="/therapist-portal/calendar" element={<TherapistCalendar />} />
              <Route path="/therapist-portal/clients" element={<TherapistClients />} />
              <Route path="/therapist-portal/earnings" element={<TherapistEarnings />} />
              <Route path="/therapist-portal/profile-edit" element={<TherapistProfileEdit />} />
            </Route>

            {/* Admin portal */}
            <Route element={
              <ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>
            }>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/therapists" element={<AdminTherapists />} />
              <Route path="/admin/clients" element={<AdminClients />} />
              <Route path="/admin/sessions" element={<AdminSessions />} />
              <Route path="/admin/finance" element={<AdminFinance />} />
              <Route path="/admin/content" element={<AdminContent />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
