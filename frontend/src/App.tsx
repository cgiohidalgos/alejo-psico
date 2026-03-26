import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Cases from "./pages/Cases";
import Interview from "./pages/Interview";
import ClinicalHistory from "./pages/ClinicalHistory";
import Evaluation from "./pages/Evaluation";
import AdminPanel from "./pages/AdminPanel";
import TeacherPanel from "./pages/TeacherPanel";
import CaseDetail from "./pages/CaseDetail";
import GuestDemo from "./pages/GuestDemo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/demo" element={<GuestDemo />} />

          {/* Student flow */}
          <Route path="/" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><Index /></ProtectedRoute>} />
          <Route path="/casos" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><Cases /></ProtectedRoute>} />
          <Route path="/caso/:id" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><CaseDetail /></ProtectedRoute>} />
          <Route path="/entrevista" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><Interview /></ProtectedRoute>} />
          <Route path="/historia" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><ClinicalHistory /></ProtectedRoute>} />
          <Route path="/evaluacion" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><Evaluation /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminPanel /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="/teacher" element={<ProtectedRoute roles={["teacher", "admin"]}><TeacherPanel /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
