import React, {useState, useEffect, useMemo} from "react";
import axios from "../axiosConfig"; // s'assurer d'utiliser axiosConfig
import { useNavigate, useParams, Link } from "react-router-dom";
import { processError } from '../utils/errorUtils';
import {formatRecipeText} from "../utils/textUtils";

const AdminCocktailForm = () => {
    const [form, setForm] = useState({
        name: "",
        theme: "",
        recipe: "",
        description: "",
        image: "",
        color: "#13a444",
        textColor: "black"
    });

    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [ingredientsList, setIngredientsList] = useState([
        { name: "", quantity: "", unit: "" }
    ]);

    // ajout du state pour gérer les erreurs de validation
    const [errorMessage, setErrorMessage] = useState("");
    const [spotifySeeds, setSpotifySeeds] = useState([]);
    const [existingThemes, setExistingThemes] = useState([]);
    const [useCustomTheme, setUseCustomTheme] = useState(false);
    const [resolvedSeeds, setResolvedSeeds] = useState([]);

    const FALLBACK_GENRES = [
      "pop","rock","hip hop","jazz","electronic","house","reggae","latin","disco","classical","ambient","chill"
    ];

    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (id) {
            const token = localStorage.getItem("token");
            axios.get(`http://localhost:5000/api/cocktails/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            }).then(res => {
                const c = res.data;
                setForm({
                    name: c.name,
                    theme: c.theme,
                    recipe: c.recipe,
                    description: c.description,
                    image: c.image,
                    thumbnail: c.thumbnail,
                    color: c.color || "#13a444",
                    textColor: c.textColor || "black",
                });
                setPreviewUrl(`http://localhost:5000/uploads/${c.image}`);
                setThumbnailUrl(`http://localhost:5000/uploads/${c.thumbnail}`);
                setIngredientsList(c.ingredients);
            });
        }
    }, [id]);

    useEffect(() => {
        let mounted = true;
        const loadGenres = async () => {
          try {
            const res = await axios.get("/spotify/genres");
            if (!mounted) return;
            const seeds = Array.isArray(res.data?.spotifySeeds) ? res.data.spotifySeeds : [];
            const themes = Array.isArray(res.data?.existingThemes) ? res.data.existingThemes : [];
            setSpotifySeeds(seeds.length ? seeds : FALLBACK_GENRES);
            setExistingThemes(themes || []);
          } catch (err) {
            console.warn("Erreur loadGenres:", err?.message || err);
            if (mounted) {
                setSpotifySeeds(FALLBACK_GENRES);
                setExistingThemes([]);
            }
          }
        };
        loadGenres();
        return () => { mounted = false; };
    }, []);

    // When loading an existing cocktail, if its theme isn't in genres, enable custom mode
    useEffect(() => {
        if (!spotifySeeds.length) return;
        if (id) { // editing existing cocktail
            // assume you've already fetched cocktail data into `form` state somewhere above
            const currentTheme = form.theme || "";
            if (currentTheme && !spotifySeeds.includes(currentTheme.toLowerCase()) && !spotifySeeds.includes(currentTheme)) {
                setUseCustomTheme(true);
            } else {
                setUseCustomTheme(false);
            }
        }
    }, [spotifySeeds, id, form.theme]);

    useEffect(() => {
    const t = (form.theme || "").trim();
    if (!t) { setResolvedSeeds([]); return; }
    axios.get("/spotify/resolve-theme", { params: { theme: t } })
      .then(r => setResolvedSeeds(r.data?.seeds || []))
      .catch(() => setResolvedSeeds([]));
  }, [form.theme]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
      const file = e?.target?.files?.[0];
      if (!file) return; // nothing selected
      // revoke previous blob url if created
      try {
        if (previewUrl && typeof previewUrl === "string" && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch (err) {
        console.warn("revokeObjectURL failed:", err);
      }

      // Only create object URL for File/Blob objects
      try {
        if (file instanceof Blob) {
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
          setImageFile(file);
          setForm(prev => ({ ...prev, image: "" })); // clear any string path
        } else if (typeof file === "string") {
          // fallback: sometimes you may set a URL string directly
          setPreviewUrl(file);
          setImageFile(null);
          setForm(prev => ({ ...prev, image: file }));
        } else {
          console.warn("Unsupported file type:", file);
          setErrorMessage("Fichier non supporté.");
        }
      } catch (err) {
        console.error("handleFileChange createObjectURL error:", err);
        setErrorMessage("Erreur lors du chargement de l'image.");
      }
    };

    const handleThumbnailChange = (e) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      try {
        if (thumbnailUrl && typeof thumbnailUrl === "string" && thumbnailUrl.startsWith("blob:")) {
          URL.revokeObjectURL(thumbnailUrl);
        }
      } catch (err) {
        console.warn("revokeObjectURL failed:", err);
      }

      try {
        if (file instanceof Blob) {
          const url = URL.createObjectURL(file);
          setThumbnailUrl(url);
          setThumbnailFile(file);
          setForm(prev => ({ ...prev, thumbnail: "" }));
        } else if (typeof file === "string") {
          setThumbnailUrl(file);
          setThumbnailFile(null);
          setForm(prev => ({ ...prev, thumbnail: file }));
        } else {
          console.warn("Unsupported thumbnail type:", file);
          setErrorMessage("Fichier miniature non supporté.");
        }
      } catch (err) {
        console.error("handleThumbnailChange createObjectURL error:", err);
        setErrorMessage("Erreur lors du chargement de la miniature.");
      }
    };

    const handleIngredientChange = (index, e) => {
        const { name, value } = e.target;
        const newIngredients = [...ingredientsList];
        newIngredients[index][name] = value;
        setIngredientsList(newIngredients);
    };
    const handleAddIngredient = () => {
        setIngredientsList([...ingredientsList, { name: "", quantity: "", unit: "" }]);
    };
    const handleRemoveIngredient = (index) => {
        const newIngredients = ingredientsList.filter((_, i) => i !== index);
        setIngredientsList(newIngredients);
    };

    // validateIngredients -> include quantityMode, allow empty quantity for non-exact
    const validateIngredients = (ingredientsArray) => {
      const filled = (ingredientsArray || []).filter(i => i && String(i.name || "").trim());
      if (filled.length === 0) {
        return { ok: false, message: "Vous devez ajouter au moins un ingrédient avec un nom." };
      }
      const sanitized = filled.map(it => {
        const name = String(it.name).trim();
        const unit = it.unit ? String(it.unit).trim() : "";
        const mode = it.quantityMode || "exact"; // default
        const raw = it.quantity;
        let quantity = null;
        if (mode === "exact") {
          // require numeric or textual but allow empty -> set null (backend can reject if needed)
          if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
            const num = Number(String(raw).replace(",", "."));
            quantity = Number.isFinite(num) ? num : String(raw).trim();
            // if numeric zero, convert to null and set as_needed mode
            if (quantity === 0) {
              quantity = null;
              // prefer explicit mode from UI, else mark as as_needed
            }
          } else {
            quantity = null;
          }
        } else {
          // non-exact modes don't require quantity value
          quantity = raw !== undefined && raw !== null && String(raw).trim() !== "" ? (isNaN(Number(String(raw).replace(",", "."))) ? String(raw).trim() : Number(String(raw).replace(",", "."))) : null;
        }
        return { name, quantity, unit, quantityMode: mode };
      });
      return { ok: true, ingredients: sanitized };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        const v = validateIngredients(ingredientsList);
        if (!v.ok) { setErrorMessage(v.message); return; }

        const fd = new FormData();
        fd.append("name", form.name);
        fd.append("theme", form.theme);
        fd.append("recipe", form.recipe);
        fd.append("description", form.description);
        fd.append("color", form.color);
        fd.append("textColor", form.textColor);
        // When building FormData, stringify the sanitized ingredients
        fd.append("ingredients", JSON.stringify(v.ingredients));
        if (imageFile) fd.append("image", imageFile);
        if (thumbnailFile) fd.append("thumbnail", thumbnailFile);

        try {
            if (id) {
                await axios.put(`/cocktails/${id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            } else {
                await axios.post("/cocktails", fd, { headers: { "Content-Type": "multipart/form-data" } });
            }
            navigate("/admin/cocktails");
        } catch (err) {
            setErrorMessage(err.response?.data?.message || err.message);
        }
    };

    const ingredientsDisplay = useMemo(() => {
        return ingredientsList.length > 0
            ? ingredientsList
                .filter(item => item.name && item.quantity && item.unit)
                .map((item, idx) => (
                    <li key={idx}>
                        {item.quantity}{item.unit} de {item.name}
                    </li>
                ))
            : null;
    }, [ingredientsList]);

    const handleThemeSelect = (value) => {
        if (value === "__custom__") {
            setUseCustomTheme(true);
            setForm({ ...form, theme: "" });
        } else {
            setUseCustomTheme(false);
            setForm({ ...form, theme: value });
        }
    };

    const isEdit = Boolean(id);

    return (
        <div className="admin-cocktail-form">
            {/* Breadcrumb */}
            <div className="breadcrumb">
                <Link to="/admin" className="breadcrumb-link">
                    <i className="bi bi-house"></i> Dashboard
                </Link>
                <i className="bi bi-chevron-right" />
                <Link to="/admin/cocktails" className="breadcrumb-link">
                    Gestion des cocktails
                </Link>
                <i className="bi bi-chevron-right" />
                <span>{isEdit ? 'Modifier cocktail' : 'Nouveau cocktail'}</span>
            </div>

            <div className="form-header">
                <h1>{isEdit ? 'Modifier le Cocktail' : 'Ajouter un Nouveau Cocktail'}</h1>
                <div className="header-actions">
                    <Link to="/admin/cocktails" className="btn btn-secondary">
                        <i className="bi bi-arrow-left"></i>
                        Retour à la liste
                    </Link>
                </div>
            </div>

            <div className="container pt-5 pb-5">
                <div className="row g-0">
                    <div className="col-md-5">
                        <div className="card preview-card">
                            <div className="card-body text-center">
                                <div
                                    className="p-3 pb-1 mb-3 m-auto"
                                    style={{
                                        backgroundColor: "#121212",
                                        borderRadius: "70px",
                                        width: "100%",
                                        maxWidth: "300px",
                                        boxShadow: "rgba(0, 0, 0, 0.35) 0px 5px 15px",
                                    }}
                                >
                                    <h3
                                        className="card-title mb-3 text-center"
                                        style={{ color: form.color, fontSize: "clamp(1.2rem, 2.5vw, 1.8rem)" }}
                                    >
                                        {form.name || "Nom du cocktail"}
                                    </h3>

                                    <div
                                        style={{
                                            position: "relative",
                                            width: "100%",
                                            paddingTop: "100%",
                                            backgroundImage: `url(${thumbnailUrl || "/thumbnail-placeholder.jpg"})`,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                            borderRadius: "60px",
                                            borderWidth: "20px",
                                            borderStyle: "solid",
                                            borderColor: form.color,
                                            overflow: "hidden",
                                            margin: "0 auto 15px",
                                        }}
                                        role="img"
                                        aria-label={form.name ? `${form.name} preview` : "Aperçu du cocktail"}
                                    >
                                        <img
                                            src={previewUrl || "/cocktail-placeholder.png"}
                                            alt={form.name || "Aperçu du cocktail"}
                                            style={{
                                                position: "absolute",
                                                top: "50%",
                                                left: "50%",
                                                transform: "translate(-50%, -50%)",
                                                maxWidth: "80%",
                                                maxHeight: "80%",
                                                objectFit: "contain",
                                                borderRadius: "10px",
                                            }}
                                        />
                                    </div>
                                </div>

                                <h5 className="text-muted">{form.theme || "Thème du cocktail"}</h5>
                                <strong>Description :</strong>
                                <p className="mt-2">{form.description || "Pas de description"}</p>
                                <strong>Ingrédients :</strong>
                                {ingredientsDisplay ? (
                                    <ul className="text-start mt-2">{ingredientsDisplay}</ul>
                                ) : (
                                    <p>Aucun ingrédient</p>
                                )}
                                <strong>Recette :</strong>
                                <p className="text-start mt-2">{formatRecipeText(form.recipe) || "Pas de recette"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-7">
                        <div className="card p-4 filling-card">
                            <h4 className="mb-4">{id ? "Modifier" : "Ajouter"} un Cocktail</h4>

                            {/* Affiche l'erreur si présente */}
                            {errorMessage && (
                                <div className="alert alert-danger" role="alert">
                                    {errorMessage}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Nom</label>
                                    <input type="text" className="form-control" name="name" value={form.name}
                                           onChange={handleChange} required/>
                                </div>

                                <div className="mb-3">
  <label className="form-label">Thème</label>
  <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
    <select
      className="form-select"
      value={ useCustomTheme ? "__custom__" : (form.theme || "") }
      onChange={(e) => handleThemeSelect(e.target.value)}
      style={{minWidth:260}}
    >
      <option value="">Sélectionnez un thème...</option>

      {existingThemes.length > 0 && (
        <optgroup label="Thèmes existants">
          {existingThemes.map(t => (
            <option key={`ex-${t}`} value={t}>{t}</option>
          ))}
        </optgroup>
      )}

      {spotifySeeds.length > 0 && (
        <optgroup label="Genres Spotify">
          {spotifySeeds.map(g => (
            <option key={`sp-${g}`} value={g}>{g}</option>
          ))}
        </optgroup>
      )}

      <option value="__custom__">Autre (saisir manuellement)</option>
    </select>

    {useCustomTheme && (
      <input
        type="text"
        className="form-control"
        placeholder="Saisissez votre thème personnalisé..."
        value={form.theme || ""}
        onChange={(e) => setForm({ ...form, theme: e.target.value })}
        style={{minWidth:220}}
      />
    )}
  </div>

  {form.theme && (
    <div className="form-text mt-1">
      Seeds Spotify proposées: {(resolvedSeeds || []).join(", ") || "pop (défaut)"}
    </div>
  )}
</div>

                                <div className="mb-3">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-control" name="description" value={form.description}
                                              onChange={handleChange} rows="2" required/>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Ingrédients</label>
                                    {ingredientsList.map((ingredient, index) => (
                                        <div key={index} className="d-flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                name="name"
                                                placeholder="Nom"
                                                value={ingredient.name}
                                                onChange={(e) => handleIngredientChange(index, e)}
                                                className="form-control"
                                                required
                                            />
                                            <input
                                                type="number"
                                                name="quantity"
                                                placeholder="Quantité"
                                                value={ingredient.quantity}
                                                onChange={(e) => handleIngredientChange(index, e)}
                                                className="form-control"
                                                required
                                            />
                                            <input
                                                type="text"
                                                name="unit"
                                                placeholder="Unité"
                                                value={ingredient.unit}
                                                onChange={(e) => handleIngredientChange(index, e)}
                                                className="form-control"
                                                required
                                            />
                                            <select
                                              className="form-select form-select-sm ms-2"
                                              value={ingredientsList[index].quantityMode || "exact"}
                                              onChange={(e) => handleIngredientChange(index, { target: { name: "quantityMode", value: e.target.value } })}
                                            >
                                              <option value="exact">Exact</option>
                                              <option value="to_taste">Au goût</option>
                                              <option value="as_needed">À volonté</option>
                                              <option value="garnish">Garniture</option>
                                              <option value="count">Nombre</option>
                                            </select>
                                            {ingredientsList.length > 1 && (
                                                <button type="button" className="btn btn-danger" onClick={() => handleRemoveIngredient(index)}>
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" className="btn btn-secondary mt-2" onClick={handleAddIngredient}>+ Ajouter un ingrédient</button>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Recette</label>
                                    <textarea className="form-control" name="recipe" value={form.recipe}
                                              onChange={handleChange} rows="3" required/>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Couleur associée</label>
                                    <input type="color" className="form-control form-control-color" name="color"
                                           value={form.color} onChange={handleChange}/>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label d-block">Couleur du texte</label>
                                    <div className="form-check form-check-inline">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="textColor"
                                            id="textColorBlack"
                                            value="black"
                                            checked={form.textColor === "black"}
                                            onChange={handleChange}
                                        />
                                        <label className="form-check-label" htmlFor="textColorBlack">Noir</label>
                                    </div>
                                    <div className="form-check form-check-inline">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="textColor"
                                            id="textColorWhite"
                                            value="white"
                                            checked={form.textColor === "white"}
                                            onChange={handleChange}
                                        />
                                        <label className="form-check-label" htmlFor="textColorWhite">Blanc</label>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label">Image</label>
                                    <input type="file" className="form-control" accept="image/*" name="image"
                                           onChange={handleFileChange} aria-label="Téléverser l'image principale" {...(!id && {required: true})} />
                                </div>

                                <div className="mb-4">
                                    <label className="form-label">Miniature</label>
                                    <input type="file" className="form-control" accept="image/*" name="thumbnail"
                                           onChange={handleThumbnailChange} aria-label="Téléverser la miniature" {...(!id && {required: true})} />
                                </div>

                                <button type="submit" className="btn btn-success d-block mx-auto px-5">
                                    {id ? "Modifier" : "Ajouter"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminCocktailForm;
