import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useDebounce from "../hooks/useDebounce";
import useIntersection from "../hooks/useIntersection";

// helper pour construire URL d'upload et fallback placeholder
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const placeholder = `${process.env.PUBLIC_URL || ""}/thumbnail-placeholder.jpg`;
const getUploadUrl = (filename) => {
    if (!filename) return placeholder;
    if (/^https?:\/\//i.test(filename)) return filename;
    return `${API_BASE}/uploads/${filename}`;
};

// helper contraste simple
const getContrastColor = (hex) => {
    if (!hex) return "#000";
    const c = hex.replace("#","").trim();
    if (c.length !== 6) return "#000";
    const r = parseInt(c.substr(0,2),16);
    const g = parseInt(c.substr(2,2),16);
    const b = parseInt(c.substr(4,2),16);
    // relative luminance approximation
    const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    return lum > 0.6 ? "#000" : "#fff";
};

// Sous-composant pour une miniature (permet d'utiliser un hook sans violer les règles)
const ThumbnailItem = React.memo(function ThumbnailItem({ cock, selectedId, onSelect, isFavorite }) {
    const { ref, intersecting } = useIntersection();
    const handleImgError = (e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = placeholder;
    };
    
    return (
        <div
            className="position-relative me-3"
            onClick={() => onSelect(cock)}
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onSelect(cock); }}
        >
            <img
                ref={ref}
                src={intersecting ? getUploadUrl(cock.image) : placeholder}
                alt={cock.name}
                onError={handleImgError}
                className="cocktail-thumb"
                style={{
                    backgroundImage: `url('${getUploadUrl(cock.thumbnail)}')`,
                    border: selectedId === cock._id ? "4px solid white" : "",
                    backgroundSize: "cover"
                }}
            />
            {isFavorite && (
                <span className="favorite-star" aria-hidden="true">★</span>
            )}
        </div>
    );
});

const CocktailList = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQ = searchParams.get("q") || "";
    const initialPage = parseInt(searchParams.get("page") || "1", 10);
    const initialLimit = parseInt(searchParams.get("limit") || "12", 10);

    const [cocktails, setCocktails] = useState([]);
    const [favoritesList, setFavoritesList] = useState([]); // <-- new state
    const [selectedCocktail, setSelectedCocktail] = useState(null);
    const [favoriteIds, setFavoriteIds] = useState([]);
    const [displayAnimation, setDisplayAnimation] = useState("animate-in");
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // recherche + pagination
    const [query, setQuery] = useState(initialQ);
    const debouncedQuery = useDebounce(query, 500);
    const [page, setPage] = useState(initialPage);
    const [limit, setLimit] = useState(initialLimit);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // motion
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const check = () => {
            const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const smallScreen = window.innerWidth < 768;
            setReducedMotion(prefersReduced || smallScreen);
        };
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // sync URL
    useEffect(() => {
        const params = {};
        if (debouncedQuery) params.q = debouncedQuery;
        if (page && page > 1) params.page = String(page);
        if (limit && limit !== 12) params.limit = String(limit);
        setSearchParams(params, { replace: true });
    }, [debouncedQuery, page, limit, setSearchParams]);

    // fetch favorites on mount
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) fetchFavorites();
    }, []);

    // React Query — fetch list
    const queryClient = useQueryClient();
    const fetchList = async ({ queryKey }) => {
        const [, { q, page, limit }] = queryKey;
        const { data } = await axios.get(`${API_BASE}/api/cocktails`, { params: { q: q || undefined, page, limit } });
        return data;
    };
    const { data: listPayload, isFetching } = useQuery({
        queryKey: ["cocktails", { q: debouncedQuery, page, limit }],
        queryFn: fetchList,
        keepPreviousData: true
    });

    // set UI state when data changes
    useEffect(() => {
        if (!listPayload) return;
        const data = listPayload.data || [];
        setCocktails(data);
        setTotalPages(listPayload.totalPages || 1);
        setTotalItems(listPayload.total || data.length);
        if (data.length > 0 && (!selectedCocktail || !data.find(c => c._id === selectedCocktail._id))) {
            setSelectedCocktail(data[0]);
        }
        // prefetch next page
        if ((listPayload.page || page) < (listPayload.totalPages || 1)) {
            const nextPage = (listPayload.page || page) + 1;
            queryClient.prefetchQuery({
                queryKey: ["cocktails", { q: debouncedQuery, page: nextPage, limit }],
                queryFn: fetchList
            });
        }
    }, [listPayload]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchFavorites = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`${API_BASE}/api/favorites`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            // res.data expected to be an array of cocktail objects (if your backend returns only ids adjust accordingly)
            setFavoritesList(res.data || []); // <-- store full favorite cocktail objects
            setFavoriteIds((res.data || []).map(fav => fav._id));
        } catch (err) {
            console.error(err);
        }
    };

    // Keep selection in sync when switching to favorites mode
    useEffect(() => {
        if (showFavoritesOnly) {
            if (favoritesList.length > 0) {
                // if current selected not in favorites, pick first favorite
                if (!selectedCocktail || !favoritesList.find(c => c._id === selectedCocktail._id)) {
                    setSelectedCocktail(favoritesList[0]);
                }
            } else {
                // no favorites -> clear selection
                setSelectedCocktail(null);
            }
        } else {
            // when leaving favorites mode, ensure selectedCocktail belongs to current page results
            if (cocktails.length > 0 && (!selectedCocktail || !cocktails.find(c => c._id === selectedCocktail._id))) {
                setSelectedCocktail(cocktails[0]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showFavoritesOnly, favoritesList, cocktails]);

    // derive visible list depending on mode (fix: visibleCocktails was missing)
    const visibleCocktails = useMemo(() => {
        let list = showFavoritesOnly ? favoritesList : cocktails;
        
        // ✅ Appliquer la recherche même en mode favoris
        if (debouncedQuery && debouncedQuery.trim()) {
            const searchTerm = debouncedQuery.toLowerCase();
            list = list.filter(cocktail => 
                cocktail.name.toLowerCase().includes(searchTerm) ||
                cocktail.theme.toLowerCase().includes(searchTerm) ||
                cocktail.description.toLowerCase().includes(searchTerm)
            );
        }
        
        return list;
    }, [showFavoritesOnly, favoritesList, cocktails, debouncedQuery]);

    const handleFavoriteToggle = async () => {
        const token = localStorage.getItem("token");
        if (!token) return alert("Connecte-toi pour ajouter aux favoris");
        
        const isFav = favoriteIds.includes(selectedCocktail._id);
        
        try {
            if (isFav) {
                await axios.delete(`${API_BASE}/api/favorites/remove/${selectedCocktail._id}`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                // ✅ Actualisation immédiate
                setFavoriteIds(prev => prev.filter(id => id !== selectedCocktail._id));
                setFavoritesList(prev => prev.filter(c => c._id !== selectedCocktail._id));
            } else {
                await axios.post(`${API_BASE}/api/favorites/add/${selectedCocktail._id}`, {}, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                // ✅ Actualisation immédiate
                setFavoriteIds(prev => [...prev, selectedCocktail._id]);
                setFavoritesList(prev => [...prev, selectedCocktail]);
            }
        } catch (err) {
            console.error("Erreur favoris:", err);
            alert("Erreur lors de la modification des favoris");
        }
    };

    const handleSelect = (cocktail) => {
        if (selectedCocktail && cocktail._id === selectedCocktail._id) return;
        if (reducedMotion) { setSelectedCocktail(cocktail); return; }
        setDisplayAnimation("animate-out");
        setTimeout(() => { setSelectedCocktail(cocktail); setDisplayAnimation("animate-in"); }, 900);
    };

    const handleImgError = useCallback((e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = placeholder;
    }, []);

    // Pagination
    const goToPage = (p) => {
        const newPage = Math.max(1, Math.min(totalPages || 1, p));
        if (newPage === page) return;
        setPage(newPage);
        window.scrollTo({ top: 200, behavior: "smooth" });
    };
    const prevPage = () => goToPage(page - 1);
    const nextPage = () => goToPage(page + 1);
    const changeLimit = (e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); };

    const pageButtons = useMemo(() => {
        const total = totalPages || 1;
        const current = page || 1;
        const delta = 2;
        const range = [];
        for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) range.push(i);
        const pages = [];
        if (1 < range[0]) { pages.push(1); if (2 < range[0]) pages.push("left-ellipsis"); }
        pages.push(...range);
        if (range[range.length - 1] < total) { if (range[range.length - 1] + 1 < total) pages.push("right-ellipsis"); pages.push(total); }
        return pages;
    }, [page, totalPages]);

    const animationClass = reducedMotion ? "" : displayAnimation;

    return (
        <div className="container-fluid py-4 cocktail-list">
            {/* Search input */}
            <div className="row mb-3">
                <div className="col-12 d-flex justify-content-center">
                    <input
                        type="text"
                        className="form-control w-50"
                        placeholder="Rechercher par nom, ingrédient ou thème..."
                        aria-label="Rechercher un cocktail par nom, ingrédient ou thème"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {isFetching && (
                <div className="row mb-2">
                    <div className="col-12 d-flex justify-content-center">
                        <div className="spinner-border text-light" role="status" aria-hidden="true" />
                        <span className="visually-hidden">Chargement...</span>
                    </div>
                </div>
            )}

            {/* main content */}
            <div className="row g-0 d-flex align-items-stretch">
                <div className="col-md-6 d-flex flex-column justify-content-center py-3 py-md-5 pe-md-4">
                    {selectedCocktail && (
                        <div className={`cocktail-infos ${animationClass}`}
                            style={{
                                backgroundImage: `url('${getUploadUrl(selectedCocktail.thumbnail)}')`,
                                backgroundSize: "cover"
                            }}>
                            <h2 className="cocktail-theme mb-4" style={{color: selectedCocktail.color, textShadow: `2px 2px 3px ${selectedCocktail.textColor}`}}>
                                {selectedCocktail.theme}
                            </h2>
                            <h1 className="cocktail-description mb-4" style={{textShadow: "2px 2px 3px black"}}>{selectedCocktail.description}</h1>
                            <div className="mt-4 d-flex flex-wrap justify-content-md-start justify-content-center">
                                <Link to={`/cocktails/${selectedCocktail._id}`} className="btn btn-light me-4 mb-sm-3 mb-3 shadow high-contrast-btn"
                                      aria-label={`En savoir plus sur ${selectedCocktail.name}`}
                                      style={{
                                          backgroundColor: selectedCocktail.color,
                                          borderColor: selectedCocktail.color,
                                          color: getContrastColor(selectedCocktail.color)
                                      }}>En savoir plus</Link>
                                <button
                                    className={`btn btn-outline-warning mb-sm-3 mb-3 shadow high-contrast-btn`}
                                    onClick={handleFavoriteToggle}
                                    aria-pressed={favoriteIds.includes(selectedCocktail._id)}
                                    aria-label={favoriteIds.includes(selectedCocktail._id) ? `Retirer ${selectedCocktail.name} des favoris` : `Ajouter ${selectedCocktail.name} aux favoris`}
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
                        <div className={`cocktail-display d-flex align-items-center justify-content-center ${animationClass}`}
                             style={{backgroundColor: selectedCocktail.color}}>
                            <img 
                                src={getUploadUrl(selectedCocktail.image)} 
                                alt={selectedCocktail.name} 
                                onError={handleImgError}
                                className={`cocktail-main-img cocktail-display-image ${animationClass}`}
                            />
                            <div className="cocktail-name" style={{ color: selectedCocktail.textColor }}>{selectedCocktail.name.toUpperCase()}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="row mt-3">
                <div className="col d-flex align-items-center">
                    <div className="d-flex align-items-center ms-2 me-4 ms-lg-5 ms-md-5 ms-sm-2 me-md-3 me-lg-3 me-sm-4">
                       <span
                           onClick={async () => {
                               // toggle and ensure favorites are loaded when enabling the view
                               const newState = !showFavoritesOnly;
                               setShowFavoritesOnly(newState);
                               if (newState && favoritesList.length === 0) {
                                   await fetchFavorites();
                               }
                           }}
                           style={{cursor: "pointer", fontSize: "2rem"}}
                           className="text-warning star-filter"
                           role="button"
                           aria-pressed={showFavoritesOnly}
                       >
                          <i className={`bi ${showFavoritesOnly ? "bi-star-fill" : "bi-star"}`}></i>
                        </span>
                    </div>
                    <div className="d-flex overflow-auto cocktails-listing">
                        {visibleCocktails
                            .filter(cocktail => !showFavoritesOnly || favoriteIds.includes(cocktail._id))
                            .map((cocktail) => (
                            <ThumbnailItem 
                                key={cocktail._id}
                                cock={cocktail}
                                selectedId={selectedCocktail?._id}
                                onSelect={handleSelect}
                                isFavorite={favoriteIds.includes(cocktail._id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Pagination UI - hide when showing favorites (we display full favorites list) */}
            {!showFavoritesOnly && (
              <div className="row mt-3">
                  <div className="col-12 d-flex align-items-center justify-content-between pagination-container">
                      <div className="d-flex align-items-center gap-2">
                          <button className="btn btn-sm btn-outline-light" onClick={() => goToPage(1)} disabled={page <= 1} aria-label="Aller à la première page">« First</button>
                          <button className="btn btn-sm btn-outline-light" onClick={prevPage} disabled={page <= 1} aria-label="Page précédente">← Prev</button>

                          <div className="d-flex align-items-center gap-1 ms-2" role="navigation" aria-label="Pagination">
                              {pageButtons.map((p, idx) => (
                                  p === "left-ellipsis" || p === "right-ellipsis" ? (
                                      <span key={p + idx} className="page-ellipsis">…</span>
                                  ) : (
                                      <button
                                          key={p}
                                          className={`btn btn-sm page-btn ${p === page ? "active" : ""}`}
                                          onClick={() => goToPage(p)}
                                          aria-current={p === page ? "page" : undefined}
                                          aria-label={p === page ? `Page ${p}, page courante` : `Aller à la page ${p}`}
                                      >
                                          {p}
                                      </button>
                                  )
                              ))}
                          </div>

                          <button className="btn btn-sm btn-outline-light" onClick={nextPage} disabled={page >= totalPages} aria-label="Page suivante">Next →</button>
                          <button className="btn btn-sm btn-outline-light" onClick={() => goToPage(totalPages)} disabled={page >= totalPages} aria-label="Aller à la dernière page">Last »</button>

                          <span className="ms-3" style={{color: "#ddd"}}>
                              Page {page} / {totalPages} — {totalItems} résultats
                          </span>
                      </div>

                      <div className="d-flex align-items-center">
                          <label className="me-2 mb-0" style={{color: "#ddd"}}>Par page</label>
                          <select className="form-select form-select-sm" value={limit} onChange={changeLimit} aria-label="Nombre d'éléments par page">
                              <option value={6}>6</option>
                              <option value={12}>12</option>
                              <option value={24}>24</option>
                              <option value={48}>48</option>
                          </select>
                      </div>
                  </div>
              </div>
            )}

            {/* Small info when in favorites mode */}
            {showFavoritesOnly && (
                <div className="row mt-2">
                    <div className="col-12 text-center text-muted">
                        Affichage de {favoritesList.length} favori{favoritesList.length > 1 ? "s" : ""} (pagination désactivée)
                    </div>
                </div>
            )}
        </div>

    );
};

export default CocktailList;