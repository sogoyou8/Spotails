import React, { useEffect, useState } from "react";
import {useParams} from "react-router-dom";
import axios from "axios";
import "bootstrap-icons/font/bootstrap-icons.css";
import NotFoundPage from "./NotFoundPage";
import "../styles/CocktailDetail.css";
import {formatRecipeText} from "../utils/textUtils";

const CocktailDetail = () => {
    const { id } = useParams();
    const [cocktail, setCocktail] = useState(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [personCount, setPersonCount] = useState(1);

    useEffect(() => {
        const fetchCocktail = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await axios.get(`http://localhost:5000/api/cocktails/${id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setCocktail(res.data);
            } catch (err) {
                setNotFound(true);
            }
        };

        const checkIfFavorite = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
            try {
                const res = await axios.get(
                    `http://localhost:5000/api/favorites/check/${id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsFavorite(res.data.isFavorite);
            } catch (err) {
                console.error(err);
            }
        };
        fetchCocktail();
        const token = localStorage.getItem("token");
        if (token) {
            checkIfFavorite();
        }
    }, [id]);

    const handleFavoriteToggle = async () => {
        const token = localStorage.getItem("token");
        if (!token) return alert("Connecte-toi pour ajouter aux favoris");
        try {
            if (isFavorite) {
                await axios.delete(
                    `http://localhost:5000/api/favorites/remove/${id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsFavorite(false);
            } else {
                await axios.post(
                    `http://localhost:5000/api/favorites/add/${id}`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setIsFavorite(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (notFound) return <NotFoundPage />;
    if (!cocktail) return <div>Chargement...</div>;

    return (
        <div className="container mt-5">
            <div className="d-flex flex-column">
                {cocktail && !cocktail.publish && (
                    <div className="alert alert-warning mt-3">
                        <i className="bi bi-exclamation-triangle-fill"></i> Ce cocktail n'est pas publié. Il est accessible seulement aux admins.
                    </div>
                )}
                <div className="px-5 pb-5 d-flex flex-column" style={{
                    backgroundColor: cocktail.color,
                    borderRadius: "40px 40px 0 0"
                }}>
                    <h2 className="cocktail-theme my-3 m-auto" style={{ color: cocktail.textColor }}>
                        {cocktail.theme}
                    </h2>
                    <div className="cocktail-detail-card p-5 d-flex flex-column align-items-center justify-content-center shadow" style={{
                        backgroundImage: `url(http://localhost:5000/uploads/${cocktail.thumbnail})`,
                        backgroundSize: "cover",
                        borderRadius: "20px",
                    }}>
                        {isFavorite && (
                            <span className="favorite-star-detail">★</span>
                        )}
                        <img src={`http://localhost:5000/uploads/${cocktail.image}`}
                             alt={cocktail.name} className="cocktail-main-img"/>
                        <h1 className="cocktail-name-detail mb-4" style={{textShadow: "2px 2px 3px black"}}>{cocktail.name}</h1>
                        <div className="mt-4 d-flex flex-wrap justify-content-md-start justify-content-center">
                            <button
                                className={`btn btn-outline-warning shadow`}
                                onClick={handleFavoriteToggle}
                            >
                                <i className={`bi ${isFavorite ? "bi-star-fill" : "bi-star"}`}></i>
                                {" "} {isFavorite ? "Favori" : "Ajouter aux favoris"}
                            </button>
                        </div>
                    </div>
                    <h1 className="mx-5 mt-5 text-center" style={{ color: cocktail.textColor }}><strong>{cocktail.description}</strong></h1>
                </div>
                <div className="mx-5 my-5">
                    <div className="text-center person-selector">
                        <label htmlFor="personCount" className="form-label fs-5"
                               style={{ color: cocktail.textColor === "white" ? "white" : cocktail.color }}><strong>Nombre de personnes : {personCount}</strong></label>
                        <input
                            type="range"
                            className="form-range"
                            min="1"
                            max="4"
                            value={personCount}
                            onChange={(e) => setPersonCount(parseInt(e.target.value))}
                            id="personCount"
                        />
                    </div>
                </div>
                <div className="cocktail-recipe p-5 mb-5" style={{
                    backgroundColor: cocktail.color,
                    borderRadius: "0 0 40px 40px",
                    color: cocktail.textColor
                }}>
                    <h3 className="mt-4 mb-4 text-center"><strong>Ingrédients :</strong></h3>
                    <div className="row">
                        {cocktail.ingredients.map((ingredient) => (
                            <div className="col-6 col-md-4 col-lg-3 mb-4" key={ingredient._id}>
                                <div className="card py-3 px-3 text-center h-100 shadow" style={{
                                    backgroundColor: "transparent",
                                }}>
                                    <h2 style={{ color: cocktail.textColor }}>{ingredient.quantity * personCount}</h2>
                                    <h5 style={{ color: cocktail.textColor === "white" ? "#9f9f9f" : "" }} className={cocktail.textColor === "black" ? "text-muted" : ""}>
                                        {ingredient.unit}
                                    </h5>
                                    <h4 style={{ color: cocktail.textColor }}>{ingredient.name}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                    <hr/>
                    <h3 className="mt-4 mb-4 text-center"><strong>Recette :</strong></h3>
                    <div className="row align-items-center">
                        <div className="col-md-8">
                            <p>{formatRecipeText(cocktail.recipe)}</p>
                        </div>
                        <div className="col-md-4 text-center">
                            <img
                                src={`http://localhost:5000/uploads/${cocktail.image}`}
                                alt={cocktail.name}
                                className="img-fluid cocktail-main-img mt-4 mt-md-0"
                                style={{ maxHeight: "300px", objectFit: "cover" }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CocktailDetail;
