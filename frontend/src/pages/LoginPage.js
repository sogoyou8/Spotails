import React, { useState } from "react";
import axios from "axios";
import {Link, useNavigate} from "react-router-dom";

const LoginForm = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post("http://localhost:5000/api/auth/login", {
                email,
                password,
            });
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("username", response.data.username);

            navigate("/");
        } catch (err) {
            setError("E-mail ou mot de passe incorrect");
        }
    };

    return (
        <div className="auth-form mt-5 p-5">
            <div className="container">
                <h1 className="text-center mb-4">Connexion</h1>
                <form onSubmit={handleSubmit} className="w-50 mx-auto">
                    {error && <div className="alert alert-danger">{error}</div>}
                    <div className="mb-3">
                        <label htmlFor="email" className="mb-1">E-mail</label>
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
                    <button type="submit" className="btn submit-btn w-100">Se connecter</button>

                    <div className="text-center mt-3">
                        <small>
                            Pas encore de compte ? <Link to="/register">Inscrivez-vous ici</Link>
                        </small>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginForm;
