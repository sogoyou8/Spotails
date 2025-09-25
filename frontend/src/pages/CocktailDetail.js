import React, { useEffect, useState } from "react";
import {useParams} from "react-router-dom";
import axios from "axios";
import "bootstrap-icons/font/bootstrap-icons.css";
import NotFoundPage from "./NotFoundPage";
import "../styles/CocktailDetail.css";
import {formatRecipeText} from "../utils/textUtils";
import { useQuery } from "@tanstack/react-query";
import SpotifyPlayerAdvanced from "../components/SpotifyPlayerAdvanced";
import { analytics } from '../utils/analytics';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const placeholder = `${process.env.PUBLIC_URL || ""}/thumbnail-placeholder.jpg`;
const getUploadUrl = (filename) => {
    if (!filename) return placeholder;
    if (/^https?:\/\//i.test(filename)) return filename;
    return `${API_BASE}/uploads/${filename}`;
};
const getContrastColor = (hex) => {
    if (!hex) return "#000";
    const c = hex.replace("#","").trim();
    if (c.length !== 6) return "#000";
    const r = parseInt(c.substr(0,2),16);
    const g = parseInt(c.substr(2,2),16);
    const b = parseInt(c.substr(4,2),16);
    const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    return lum > 0.6 ? "#000" : "#fff";
};

const webpSrcSet = (filename, sizes = [400, 800, 1200]) => {
    if (!filename) return "";
    const nameNoExt = filename.replace(/\.[^/.]+$/, "");
    return sizes.map(w => `${API_BASE}/uploads/${nameNoExt}_${w}.webp ${w}w`).join(", ");
};

const CocktailDetail = () => {
    const { id } = useParams();
    const [cocktail, setCocktail] = useState(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [personCount, setPersonCount] = useState(1);

    const { data: cocktailData, isFetching, isError } = useQuery({
        queryKey: ["cocktail", id],
        queryFn: async () => {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE}/api/cocktails/${id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            return res.data;
        },
        retry: 0
    });

    useEffect(() => {
        if (cocktailData) {
            setCocktail(cocktailData);
            // ✅ Track vue cocktail
            analytics.trackCocktailView(cocktailData._id, cocktailData.name);
        }
    }, [cocktailData]);

    useEffect(() => {
        const checkIfFavorite = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
            try {
                const res = await axios.get(`${API_BASE}/api/favorites/check/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                setIsFavorite(res.data.isFavorite);
            } catch {}
        };
        checkIfFavorite();
    }, [id]);

    const handleFavoriteToggle = async () => {
        const token = localStorage.getItem("token");
        if (!token) return alert("Connecte-toi pour ajouter aux favoris");
        try {
            if (isFavorite) {
                await axios.delete(`${API_BASE}/api/favorites/remove/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                setIsFavorite(false);
                // ✅ Track action favoris
                analytics.trackFavoriteToggle(id, 'remove');
            } else {
                await axios.post(`${API_BASE}/api/favorites/add/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                setIsFavorite(true);
                // ✅ Track action favoris
                analytics.trackFavoriteToggle(id, 'add');
            }
        } catch {}
    };

    const handleImgError = (e) => { 
        e.currentTarget.onerror = null; 
        e.currentTarget.src = placeholder; 
        e.currentTarget.alt = `Image de ${cocktail.name} indisponible`; // ← Plus spécifique
        e.currentTarget.style.opacity = "0.7"; // ← Indicateur visuel
    };

    const renderQuantity = (q, mode) => {
        const OPTIONAL_SYMBOL = "X"; // ← change ici si tu veux un autre signe (« ✕ », « — », etc.)
        if (mode === "to_taste") return "Au goût";
        if (mode === "as_needed") return OPTIONAL_SYMBOL;
        if (mode === "garnish") return "Garniture";
        if (mode === "count") return (typeof q === "number" ? q : (q || ""));
        // treat explicit zero as "optional" symbol for display
        if (q === 0) return OPTIONAL_SYMBOL;
        if (typeof q === "number" && Number.isFinite(q)) return q * personCount;
        if (typeof q === "string" && q.trim()) return q;
        return ""; // rien si vide
    };

    if (isError) return <NotFoundPage />;
    if (!cocktail) return <div>Chargement...</div>;

    return (
        <div className="container mt-5">
            <div className="d-flex flex-column">
                {cocktail && !cocktail.publish && (
                    <div className="alert alert-warning mt-3" role="status">
                        <i className="bi bi-exclamation-triangle-fill"></i> Ce cocktail n'est pas publié. Il est accessible seulement aux admins.
                    </div>
                )}
                <div className="px-5 pb-5 d-flex flex-column align-items-center justify-content-center" style={{
                    backgroundColor: cocktail.color,
                    borderRadius: "40px 40px 0 0"
                }}>
                    <h2 className="cocktail-theme my-3 m-auto" style={{ color: getContrastColor(cocktail.color) }}>
                        {cocktail.theme}
                    </h2>
                    <div
                        className="cocktail-detail-card p-5 d-flex flex-column align-items-center justify-content-center shadow"
                        role="img"
                        aria-label={`${cocktail.name} — ${cocktail.theme}`}
                        style={{
                            backgroundImage: `url('${getUploadUrl(cocktail.thumbnail)}')`,
                            backgroundSize: "cover",
                            borderRadius: "20px",
                        }}>
                        {isFavorite && (
                            <span className="favorite-star-detail" aria-hidden="true">★</span>
                        )}
                        <picture>
                            <source
                                type="image/webp"
                                srcSet={webpSrcSet(cocktail.image)}
                                sizes="(max-width: 768px) 90vw, 600px"
                            />
                            <img
                                src={getUploadUrl(cocktail.image)}
                                alt={cocktail.name}
                                className="cocktail-main-img"
                                onError={handleImgError}
                                style={{ opacity: isFetching ? 0.5 : 1, transition: "opacity 300ms ease" }}
                            />
                        </picture>
                        <h1 className="cocktail-name-detail mb-4" style={{textShadow: "2px 2px 3px black", color: getContrastColor(cocktail.color)}}>{cocktail.name}</h1>
                        <div className="mt-4 d-flex flex-wrap justify-content-md-start justify-content-center">
                            <button
                                className={`btn btn-outline-warning shadow high-contrast-btn`}
                                onClick={handleFavoriteToggle}
                                aria-pressed={isFavorite}
                                aria-label={isFavorite ? `Retirer ${cocktail.name} des favoris` : `Ajouter ${cocktail.name} aux favoris`}
                                style={{ color: getContrastColor(cocktail.color), borderColor: cocktail.color }}
                            >
                                <i className={`bi ${isFavorite ? "bi-star-fill" : "bi-star"}`}></i>
                                {" "} {isFavorite ? "Favori" : "Ajouter aux favoris"}
                            </button>
                        </div>
                    </div>
                    <h1 className="mx-5 mt-5 text-center" style={{ color: getContrastColor(cocktail.color) }}><strong>{cocktail.description}</strong></h1>
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
                                <div className="card py-3 px-3 text-center h-100 shadow" style={{ backgroundColor: "transparent" }}>
                                    <h2 style={{ color: cocktail.textColor }}>{renderQuantity(ingredient.quantity, ingredient.quantityMode)}</h2>
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
                                src={getUploadUrl(cocktail.image)}
                                alt={cocktail.name}
                                className="img-fluid cocktail-main-img mt-4 mt-md-0"
                                style={{ maxHeight: "300px", objectFit: "cover" }}
                                onError={handleImgError}
                            />
                        </div>
                    </div>
                    {/* Ajouter le lecteur Spotify */}
                    <SpotifyPlayerAdvanced cocktail={cocktail} />
                </div>
            </div>
        </div>
    );
};

export default CocktailDetail;
