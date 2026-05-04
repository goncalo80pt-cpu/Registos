import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import UpcomingReminder from "@/components/UpcomingReminder";
import HomePage from "@/pages/HomePage";
import CheckinPage from "@/pages/CheckinPage";
import CheckoutPage from "@/pages/CheckoutPage";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import HistoryPage from "@/pages/HistoryPage";
import BookingPage from "@/pages/BookingPage";
import BookingsAdminPage from "@/pages/BookingsAdminPage";
import WeeklyAgendaPage from "@/pages/WeeklyAgendaPage";

function AppRouter() {
  const location = useLocation();
  return (
    <>
      <UpcomingReminder />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/entrada" element={<CheckinPage />} />
        <Route path="/saida" element={<CheckoutPage />} />
        <Route path="/marcar" element={<BookingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/marcacoes" element={<BookingsAdminPage />} />
        <Route path="/agenda" element={<WeeklyAgendaPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
