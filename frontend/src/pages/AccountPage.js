import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/AccountPage.css";

const AccountPage = () => {
    const [userInfo, setUserInfo] = useState(null);
    const [activeTab, setActiveTab] = useState("account");
    const [newUsername, setNewUsername] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const navigate = useNavigate();

    const fetchUserData = async () => {
        try {
            const response = await axios.get("http://localhost:5000/api/users/me", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            setUserInfo(response.data);
            setNewUsername(response.data.username);
            setNewEmail(response.data.email);
        } catch (err) {
            setError("Impossible de récupérer les informations de l'utilisateur.");
        }
    };

    useEffect(() => {

        fetchUserData();
    }, []);

    const handleChangeUsername = async () => {
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(newUsername) || newUsername.length > 16 || newUsername.length < 3) {
            setError("Le nom d'utilisateur doit être alphanumérique et contenir entre 3 et 16 caractères.");
            setSuccessMessage("");
            return;
        }
        try {
            await axios.put(
                "http://localhost:5000/api/users/update-username",
                {username: newUsername},
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            localStorage.setItem("username", newUsername);
            setSuccessMessage("Nom d'utilisateur mis à jour avec succès !");
            setError("");
        } catch (err) {
            setError("Erreur lors de la mise à jour du pseudo. " + err.response?.data?.message || err.message);
            setSuccessMessage("");
            fetchUserData();
        }
    };

    const handleChangeEmail = async () => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(newEmail)) {
            setError("L'adresse email n'est pas valide.");
            setSuccessMessage("");
            return;
        }
        try {
            await axios.put(
                "http://localhost:5000/api/users/update-email",
                { email: newEmail },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            setSuccessMessage("E-mail mis à jour avec succès !");
            setError("");
        } catch (err) {
            setError("Erreur lors de la mise à jour de l'email. " + err.response?.data?.message || err.message);
            setSuccessMessage("");
            fetchUserData();
        }
    };

    const handleDeleteAccount = async () => {
        const confirmDelete = window.confirm(
            "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible."
        );
        if (confirmDelete) {
            try {
                await axios.delete("http://localhost:5000/api/users/delete-account", {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    data: {
                        password: prompt("Entrez votre mot de passe pour confirmer la suppression."),
                    },
                });
                alert("Compte supprimé avec succès.");
                localStorage.removeItem("token");
                navigate("/login");
            } catch (err) {
                alert("Erreur lors de la suppression du compte. " + err.response?.data?.message || err.message);
            }
        }
    };

    const handleChangePassword = async () => {
        const { currentPassword, newPassword, confirmPassword } = password;

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError("Tous les champs sont requis.");
            setSuccessMessage("");
            return;
        }

        if (newPassword.length < 8) {
            setError("Le mot de passe doit contenir au moins 8 caractères.");
            setSuccessMessage("");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Les nouveaux mots de passe ne correspondent pas.");
            setSuccessMessage("");
            return;
        }

        try {
            await axios.put(
                "http://localhost:5000/api/users/update-password",
                { currentPassword, newPassword, confirmPassword },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            setSuccessMessage("Mot de passe mis à jour avec succès.");
            setError("");
        } catch (err) {
            setError("Erreur lors de la mise à jour du mot de passe. " + err.response?.data?.message || err.message);
            setSuccessMessage("");
        }
    };

    if (!userInfo) {
        return <div>Chargement...</div>;
    }

    return (
        <div className="panel-compte">
            <div className="container pt-5 pb-5">
                <h1 className="text-center mb-4">Votre compte</h1>
                <div className="row">
                    <div className="col-md-3">
                        <div className="list-group onglets p-2 mb-3">
                            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                            <a
                                href="#"
                                className={`list-group-item ${
                                    activeTab === "account" ? "active" : "list-group-item-action"
                                }`}
                                onClick={() => setActiveTab("account")}
                            >
                                <i className="bi bi-gear"></i> Paramètres du compte
                            </a>
                            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                            <a
                                href="#"
                                className={`list-group-item ${
                                    activeTab === "security" ? "active" : "list-group-item-action"
                                }`}
                                onClick={() => setActiveTab("security")}
                            >
                                <i className="bi bi-shield"></i> Sécurité
                            </a>
                        </div>
                    </div>

                    <div className="col-md-9">
                        {activeTab === "account" && (
                            <div className="onglet p-3">
                                <h5>PARAMÈTRES DU COMPTE</h5>
                                {error && <div className="alert alert-danger">{error}</div>}
                                {successMessage && <div className="alert alert-success">{successMessage}</div>}
                                <hr/>

                                <div className="mb-3">
                                    <label className="form-label">Pseudo</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                    />
                                    <button
                                        className="btn btn-success mt-2"
                                        onClick={handleChangeUsername}
                                    >
                                        Sauvegarder
                                    </button>
                                </div>
                                <hr/>

                                <div className="mb-3">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                    />
                                    <button
                                        className="btn btn-success mt-2"
                                        onClick={handleChangeEmail}
                                    >
                                        Sauvegarder
                                    </button>
                                </div>
                                <hr/>

                                <p className="text-danger">Supprimer le compte</p>
                                <button
                                    className="btn btn-danger"
                                    onClick={handleDeleteAccount}
                                >
                                    Supprimer le compte
                                </button>
                            </div>
                        )}

                        {activeTab === "security" && (
                            <div className="onglet p-3">
                                <h5>SÉCURITÉ</h5>
                                {error && <div className="alert alert-danger">{error}</div>}
                                {successMessage && <div className="alert alert-success">{successMessage}</div>}
                                <hr />

                                <div className="mb-3">
                                    <label className="form-label">Mot de passe actuel</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={password.currentPassword || ""}
                                        placeholder="****************"
                                        onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={password.newPassword || ""}
                                        placeholder="****************"
                                        onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Confirmer le mot de passe</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={password.confirmPassword || ""}
                                        placeholder="****************"
                                        onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })}
                                    />
                                </div>
                                <button
                                    className="btn btn-success"
                                    onClick={handleChangePassword}
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;
