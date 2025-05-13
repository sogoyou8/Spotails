import React from "react";
import { Link } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/AdminPages.css";

const AdminDashboard = () => {
    return (
        <div className="admin-dashboard container mt-5">
            <h1 className="mb-4">Admin Dashboard</h1>
            <div className="row g-4">
                <div className="col-md-6">
                    <Link to="/admin/cocktails" className="text-decoration-none text-dark">
                        <div className="card h-100 p-4 clickable-card">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-cup-straw display-4 me-3 text-white"></i>
                                <div>
                                    <h5 className="card-title mb-0">Gérer les Cocktails</h5>
                                    <small className="text-muted">Ajouter, modifier ou supprimer des cocktails</small>
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="col-md-6">
                    <Link to="/admin/users" className="text-decoration-none text-dark">
                        <div className="card h-100 p-4 clickable-card">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-people-fill display-4 me-3 text-white"></i>
                                <div>
                                    <h5 className="card-title mb-0">Gérer les Comptes</h5>
                                    <small className="text-muted">Voir et gérer les utilisateurs</small>
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
