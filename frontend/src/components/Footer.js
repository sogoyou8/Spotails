import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Footer.css";
import {Link} from "react-router-dom";

const Footer = () => {
    return (
        <footer className="footer py-3">
            <div className="container d-flex flex-wrap justify-content-between align-items-center">
                <p className="footer-text col-md-4 mb-0 text-muted">
                    &copy; {new Date().getFullYear()} Spotails
                </p>
                <Link to="/" className="footer-logo d-flex align-items-center justify-content-center mb-3 mb-md-0 mx-auto link-dark text-decoration-none">
                    <img
                        src="/iconBlack.svg"
                        alt="logo"
                        width="40"
                        height="40"
                    />
                </Link>
                <ul className="footer-links nav col-md-4 justify-content-end">
                    <li className="nav-item">
                        <Link to="/"  className="footer-link nav-link px-2 text-muted">
                            Accueil
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/cocktails"  className="footer-link nav-link px-2 text-muted">
                            Cocktails
                        </Link>
                    </li>
                </ul>
            </div>
        </footer>
    );
};

export default Footer;
