import { useEffect } from "react";
import axios from '../axiosConfig';
import {Link, useNavigate} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/Navbar.css";
import { jwtDecode } from "jwt-decode";

const Navbar = () => {
    const navigate = useNavigate();
    const username = localStorage.getItem("username");
    const token = localStorage.getItem("token");
    const isAuthenticated = !!localStorage.getItem("token");

    let isAdmin = false;
    if (token) {
        const decodedToken = jwtDecode(token);
        isAdmin = decodedToken.role === "admin";
    }

    useEffect(() => {
        const checkRole = async () => {
            try {
                const res = await axios.get("http://localhost:5000/api/users/me", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (res.data.role !== jwtDecode(token).role) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("username");
                    navigate("/login");
                    window.location.reload();
                }
            } catch (err) {
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                navigate("/login");
                window.location.reload();
            }
        };

        if (token) {
            checkRole();
        }
    }, [token, navigate]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        navigate("/");
        window.location.reload();
    };
    return (
        <nav className="navbar navbar-expand-lg navbar-custom d-flex justify-content-between align-items-center">
            <div className="container">
                <Link className="navbar-brand d-flex align-items-center" to="/">
                    <img
                        src="/iconWhite.svg"
                        alt="logo"
                        width="40"
                        height="40"
                        className="d-inline-block align-text-top me-2"
                    />
                </Link>

                <div className="d-flex align-items-center">
                    <Link to="/cocktails" className="navbar-link me-4">
                        Nos Cocktails
                    </Link>
                    {isAuthenticated ? (
                        <>
                            <Link to="/account" className="navbar-link me-4">
                                <i className="bi bi-person-fill me-1"></i>
                                {username}
                            </Link>
                            {isAdmin && (
                                <Link to="/admin" className="navbar-link navbar-link-admin me-4">
                                    <i className="bi bi-gear"></i> Admin
                                </Link>
                            )}
                            <Link to="#" onClick={handleLogout} className="navbar-link navbar-link-logout me-4">
                                <i className="bi bi-box-arrow-right"></i>
                            </Link>
                        </>
                        ) : (
                        <>
                            <Link to="/login" className="navbar-link navbar-link-login me-4">
                                Connexion
                            </Link>
                            <Link to="/register" className="navbar-link navbar-link-register">
                                Inscription
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};
export default Navbar;