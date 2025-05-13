import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap-icons/font/bootstrap-icons.css";
import { processError } from '../utils/errorUtils';
import {Link} from "react-router-dom";

const AdminCocktailManager = () => {
    const [cocktails, setCocktails] = useState([]);

    const fetchCocktails = async () => {
        const config = {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        };
        const res = await axios.get("http://localhost:5000/api/cocktails/admin", config);
        setCocktails(res.data);
    };

    useEffect(() => {
        fetchCocktails();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm("Supprimer ce cocktail ?")) {
            try {
                await axios.delete(`http://localhost:5000/api/cocktails/${id}`,
                    { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                );
                fetchCocktails();
            } catch (error) {
                processError(error);
            }
        }
    };

    const handlePublishToggle = async (id, newValue) => {
        try {
            await axios.patch(`http://localhost:5000/api/cocktails/${id}/publish`,
                { publish: newValue },
                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );
            fetchCocktails();
        } catch (error) {
            processError(error);
        }
    };

    return (
        <div className="managing-panel">
            <div className="container pt-5 pb-5">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="m-0">Gestion des Cocktails</h2>
                    <Link to="/admin/cocktails/add" className="btn btn-sm btn-dark">
                        <i className="bi bi-plus-circle"></i> Ajouter un cocktail
                    </Link>
                </div>
                <table className="table table-striped mt-4">
                    <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Thème</th>
                        <th>Publier</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {cocktails.map(cocktail => (
                        <tr key={cocktail._id}>
                            <td>{cocktail.name}</td>
                            <td>{cocktail.theme}</td>
                            <td>
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={cocktail.publish}
                                        onChange={() => handlePublishToggle(cocktail._id, !cocktail.publish)}
                                    />
                                </div>
                            </td>
                            <td>
                                <Link to={`/cocktails/${cocktail._id}`} className="btn btn-sm btn-info me-2">
                                    <i className="bi bi-eye"></i>
                                </Link>
                                <Link to={`/admin/cocktails/edit/${cocktail._id}`} className="btn btn-sm btn-warning me-2">
                                    <i className="bi bi-pencil"></i>
                                </Link>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDelete(cocktail._id)}
                                >
                                    <i className="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCocktailManager;
