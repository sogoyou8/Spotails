import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const CocktailList = () => {
    const [cocktails, setCocktails] = useState([]);
    const [selectedCocktail, setSelectedCocktail] = useState(null);
    const [favoriteIds, setFavoriteIds] = useState([]);
    const [displayAnimation, setDisplayAnimation] = useState("animate-in");
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    useEffect(() => {

        fetchCocktails();
        const token = localStorage.getItem("token");
        if (token) fetchFavorites();
    }, []);

    const fetchCocktails = async () => {
        const res = await axios.get("http://localhost:5000/api/cocktails");
        setCocktails(res.data);
        setSelectedCocktail(res.data[0]);
    };

    const fetchFavorites = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("http://localhost:5000/api/favorites", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setFavoriteIds(res.data.map(fav => fav._id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleFavoriteToggle = async () => {
        const token = localStorage.getItem("token");
        if (!token) return alert("Connecte-toi pour ajouter aux favoris");

        try {
            if (favoriteIds.includes(selectedCocktail._id)) {
                await axios.delete(
                    `http://localhost:5000/api/favorites/remove/${selectedCocktail._id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setFavoriteIds(favoriteIds.filter(id => id !== selectedCocktail._id));
            } else {
                await axios.post(
                    `http://localhost:5000/api/favorites/add/${selectedCocktail._id}`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setFavoriteIds([...favoriteIds, selectedCocktail._id]);
            }
        } catch (err) {
            console.error(err);
        }
    };


    const handleSelect = (cocktail) => {
        if (selectedCocktail && cocktail._id === selectedCocktail._id) return;

        setDisplayAnimation("animate-out");
        setTimeout(() => {
            setSelectedCocktail(cocktail);
            setDisplayAnimation("animate-in");
        }, 900);
    };

    return (
        <div className="container-fluid py-4 cocktail-list">
            <div className="row g-0 d-flex align-items-stretch">
                <div className="col-md-6 d-flex flex-column justify-content-center py-3 py-md-5 pe-md-4">
                    {selectedCocktail && (
                        <div className={`cocktail-infos ${displayAnimation}`}
                            style={{
                                backgroundImage: `url(http://localhost:5000/uploads/${selectedCocktail.thumbnail})`,
                                backgroundSize: "cover"
                            }}>
                            <h2 className="cocktail-theme mb-4" style={{color: selectedCocktail.color, textShadow: `2px 2px 3px ${selectedCocktail.textColor}`}}>
                                {selectedCocktail.theme}
                            </h2>
                            <h1 className="cocktail-description mb-4" style={{textShadow: "2px 2px 3px black"}}>{selectedCocktail.description}</h1>
                            <div className="mt-4 d-flex flex-wrap justify-content-md-start justify-content-center">
                                <Link to={`/cocktails/${selectedCocktail._id}`} className="btn btn-light me-4 mb-sm-3 mb-3 shadow"
                                      style={{
                                          backgroundColor: selectedCocktail.color,
                                          borderColor: selectedCocktail.color,
                                          color: selectedCocktail.textColor
                                      }}>En savoir plus</Link>
                                <button
                                    className={`btn btn-outline-warning mb-sm-3 mb-3 shadow`}
                                    onClick={handleFavoriteToggle}
                                >
                                    <i className={`bi ${favoriteIds.includes(selectedCocktail._id) ? "bi-star-fill" : "bi-star"}`}></i>
                                    {" "} {favoriteIds.includes(selectedCocktail._id) ? "Favori" : "Ajouter aux favoris"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="col-md-6 position-relative p-0">
                    {selectedCocktail && (
                        <div className={`cocktail-display d-flex align-items-center justify-content-center ${displayAnimation}`}
                             style={{backgroundColor: selectedCocktail.color}}>
                            <img src={`http://localhost:5000/uploads/${selectedCocktail.image}`}
                                 alt={selectedCocktail.name} className={`cocktail-main-img cocktail-display-image ${displayAnimation}`}/>
                            <div className="cocktail-name" style={{ color: selectedCocktail.textColor }}>{selectedCocktail.name.toUpperCase()}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="row mt-3">
                <div className="col d-flex align-items-center">
                    <div className="d-flex align-items-center ms-2 me-4 ms-lg-5 ms-md-5 ms-sm-2 me-md-3 me-lg-3 me-sm-4">
                       <span
                           onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                           style={{cursor: "pointer", fontSize: "2rem"}}
                           className="text-warning star-filter"
                       >
                          <i className={`bi ${showFavoritesOnly ? "bi-star-fill" : "bi-star"}`}></i>
                        </span>
                    </div>
                    <div className="d-flex overflow-auto cocktails-listing">
                        {cocktails
                            .filter(cocktail => !showFavoritesOnly || favoriteIds.includes(cocktail._id))
                            .map((cocktail) => (
                            <div
                                key={cocktail._id}
                                className="position-relative me-3"
                                onClick={() => handleSelect(cocktail)}
                                style={{cursor: "pointer"}}
                            >
                                <img
                                    src={`http://localhost:5000/uploads/${cocktail.image}`}
                                    alt={cocktail.name}
                                    className="cocktail-thumb"
                                    style={{
                                        backgroundImage: `url(http://localhost:5000/uploads/${cocktail.thumbnail})`,
                                        border:
                                            selectedCocktail && selectedCocktail._id === cocktail._id
                                                ? "4px solid white"
                                                : "",
                                        backgroundSize: "cover"
                                    }}
                                />
                                {favoriteIds.includes(cocktail._id) && (
                                    <span className="favorite-star">★</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

    );
};

export default CocktailList;
