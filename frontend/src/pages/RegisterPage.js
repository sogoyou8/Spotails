import React, { useState } from "react";
import axios from "axios";
import {Link, useNavigate} from "react-router-dom";
import "../styles/FormPage.css";

const RegisterPage = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username) || username.length > 16 || username.length < 3) {
            setError("Le nom d'utilisateur doit être alphanumérique et contenir entre 3 et 16 caractères.");
            return;
        }
        if (password.length < 8) {
            setError("Le mot de passe doit contenir au moins 8 caractères.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }

        try {
            const response = await axios.post("http://localhost:5000/api/auth/register", {
                username,
                email,
                password,
            });

            localStorage.setItem("token", response.data.token);
            localStorage.setItem("username", response.data.username);

            navigate("/");
        } catch (err) {
            setError(err.response?.data?.message || "Erreur lors de l'inscription");
        }
    };

    return (
        <div className="auth-form container mt-5">
            <h1 className="text-center mb-4">Inscription</h1>
            <form onSubmit={handleSubmit} className="w-50 mx-auto">
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="mb-3">
                    <label htmlFor="username" className="mb-1">Nom d'utilisateur</label>
                    <input
                        type="text"
                        className="form-control"
                        id="username"
                        value={username}
                        placeholder="Utilisateur01"
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="email" className="mb-1">Email</label>
                    <input
                        type="email"
                        className="form-control"
                        id="email"
                        value={email}
                        placeholder="email@exemple.fr"
                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="password" className="mb-1">Mot de passe</label>
                    <div className="input-group">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="form-control"
                            id="password"
                            value={password}
                            placeholder="****************"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="btn display-pw-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <i className="bi bi-eye-fill me-1"></i> :
                                <i className="bi bi-eye-slash-fill me-1"></i>}
                        </button>
                    </div>
                </div>
                <div className="mb-3">
                    <label htmlFor="confirmPassword" className="mb-1">Confirmer le mot de passe</label>
                    <input
                        type="password"
                        className="form-control"
                        id="confirmPassword"
                        value={confirmPassword}
                        placeholder="****************"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn submit-btn w-100">S'inscrire</button>
                <div className="text-center mt-3">
                    <small>
                        Vous avez déjà un compte ? <Link to="/login">Connectez-vous ici</Link>
                    </small>
                </div>
            </form>
        </div>
    );
};

export default RegisterPage;
