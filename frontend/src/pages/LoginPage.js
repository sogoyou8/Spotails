import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../axiosConfig"; // ← Important : utilise axiosConfig
import { processError } from '../utils/errorUtils';
import "../styles/FormPage.css";

const LoginPage = () => {
    const [formData, setFormData] = useState({
        username: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        // Clear error when user starts typing
        if (error) setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            console.log("Envoi des données:", formData); // Debug
            
            const response = await axios.post("/auth/login", {
                username: formData.username,
                password: formData.password
            });

            console.log("Réponse reçue:", response.data); // Debug
            
            // Sauvegarder les données utilisateur
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("username", response.data.username);
            
            // Rediriger vers la page d'accueil
            navigate("/");
            
        } catch (error) {
            console.error("Erreur de connexion:", error);
            if (error.response?.data?.message) {
                setError(error.response.data.message);
            } else {
                setError("Erreur de connexion. Vérifiez vos identifiants.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="form-page">
            <div className="container d-flex justify-content-center align-items-center min-vh-100">
                <div className="col-md-4">
                    <div className="auth-form p-5">
                        <h2 className="text-center mb-4">Connexion</h2>
                        
                        {error && (
                            <div className="alert alert-danger" role="alert">
                                {error}
                            </div>
                        )}
                        
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <input
                                    type="text"
                                    className="form-control"
                                    name="username"
                                    placeholder="Nom d'utilisateur ou email"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            
                            <div className="mb-4">
                                <input
                                    type="password"
                                    className="form-control"
                                    name="password"
                                    placeholder="Mot de passe"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            
                            <button 
                                type="submit" 
                                className="btn btn-primary w-100"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Connexion...
                                    </>
                                ) : (
                                    "Se connecter"
                                )}
                            </button>
                        </form>
                        
                        <div className="text-center mt-3">
                            <p className="mb-0">
                                Pas encore de compte ? <Link to="/register">Inscrivez-vous ici</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
