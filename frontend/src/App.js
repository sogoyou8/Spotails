import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

function App() {
    return (
        <Router>
            <div className="d-flex flex-column flex-grow-1">
                <Navbar />
                <div className="flex-grow-1">
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
                        </Routes>
                    </Suspense>
                </div>
                <Footer />
                <FeedbackWidget />
            </div>
        </Router>
    );
}

export default App;
