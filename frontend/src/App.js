import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import PublicRoute from "./components/PublicRoute";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import NotFoundPage from "./pages/NotFoundPage";
import FeedbackWidget from './components/FeedbackWidget';

const LandingPage = lazy(() => import("./pages/LandingPage"));
const CocktailList = lazy(() => import("./pages/CocktailList"));
const CocktailDetail = lazy(() => import("./pages/CocktailDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCocktailManager = lazy(() => import("./pages/AdminCocktailManager"));
const AdminCocktailForm = lazy(() => import("./pages/AdminCocktailForm"));
const AdminUserManager = lazy(() => import("./pages/AdminUserManager"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const FavoriteTracksPage = lazy(() => import("./pages/FavoriteTracksPage"));
const ThemesPage = lazy(() => import("./pages/ThemesPage"));
const AdminFavoritesManager = lazy(() => import("./pages/AdminFavoritesManager"));
const AdminPlaylistManager = lazy(() => import("./pages/AdminPlaylistManager"));

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Navbar />
          <Suspense fallback={<div className="text-center mt-5 text-light">Chargement…</div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/cocktails" element={<CocktailList />} />
              <Route path="/cocktails/:id" element={<CocktailDetail />} />
              <Route path="/login"
                  element={
                      <PublicRoute>
                          <LoginPage/>
                      </PublicRoute>
                  }
              />
              <Route path="/register"
                  element={
                      <PublicRoute>
                          <RegisterPage />
                      </PublicRoute>
                  }
              />
              <Route path="/account"
                  element={
                      <PrivateRoute>
                          <AccountPage />
                      </PrivateRoute>
                  }
              />
              <Route path="/themes" element={<ThemesPage />} />
              <Route path="/themes/:themeParam" element={<ThemesPage />} />
              <Route path="/favorite-tracks" 
                  element={
                      <PrivateRoute>
                          <FavoriteTracksPage />
                      </PrivateRoute>
                  }
              />
              <Route path="*" element={<NotFoundPage />} />
              <Route path="/admin"
                  element={
                      <AdminRoute>
                          <AdminDashboard />
                      </AdminRoute>
                  }
              />
              <Route path="/admin/cocktails"
                  element={
                      <AdminRoute>
                          <AdminCocktailManager />
                      </AdminRoute>
                  }
              />
              <Route path="/admin/users"
                  element={
                      <AdminRoute>
                          <AdminUserManager />
                      </AdminRoute>
                  }
              />
              <Route path="/admin/cocktails/add"
                  element={
                      <AdminRoute>
                          <AdminCocktailForm />
                      </AdminRoute>
                  }
              />
              <Route path="/admin/cocktails/edit/:id"
                  element={
                      <AdminRoute>
                          <AdminCocktailForm />
                      </AdminRoute>
                  }
              />
              <Route path="/admin/favorites"
                  element={
                      <AdminRoute>
                          <AdminFavoritesManager />
                      </AdminRoute>
                  }
              />
              <Route path="/admin/playlists"
                  element={
                      <AdminRoute>
                          <AdminPlaylistManager />
                      </AdminRoute>
                  }
              />
            </Routes>
          </Suspense>
          <Footer />
          
          {/* NOUVEAU: Widget de feedback global */}
          <FeedbackWidget />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
