import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import CocktailList from "./pages/CocktailList";
import CocktailDetail from "./pages/CocktailDetail";
import LandingPage from "./pages/LandingPage";
import RegisterPage from "./pages/RegisterPage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import NotFoundPage from "./pages/NotFoundPage";
import AdminCocktailManager from "./pages/AdminCocktailManager";
import AdminUserManager from "./pages/AdminUserManager";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCocktailForm from "./pages/AdminCocktailForm";
import AccountPage from "./pages/AccountPage";
import PublicRoute from "./components/PublicRoute";
import LoginPage from "./pages/LoginPage";
import {useEffect} from "react";

function App() {

    useEffect(() => {
        const ratio = window.devicePixelRatio;
        if (ratio === 1) {
            document.body.style.zoom = "0.93";
        } else {
            document.body.style.zoom = "1";
        }
    }, []);


    return (
        <Router>
            <div className="d-flex flex-column flex-grow-1">
                <Navbar />
                <div className="flex-grow-1">
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
                </div>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
