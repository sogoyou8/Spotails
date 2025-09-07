import React, {useState, useEffect, useMemo} from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
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

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };
    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        setThumbnailFile(file);
        setThumbnailUrl(URL.createObjectURL(file));
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

    // ajout helper validation
    const validateIngredients = (ingredientsArray) => {
      if (!Array.isArray(ingredientsArray) || ingredientsArray.length === 0) {
        return { ok: false, message: "Ajoutez au moins un ingrédient." };
      }
      for (let i = 0; i < ingredientsArray.length; i++) {
        const it = ingredientsArray[i];
        if (!it.name || it.name.toString().trim() === "") {
          return { ok: false, message: `Ingrédient ${i + 1} : nom manquant.` };
        }
        if (it.quantity == null || it.quantity === "") {
          return { ok: false, message: `Ingrédient ${i + 1} : quantité manquante.` };
        }
        if (!it.unit || it.unit.toString().trim() === "") {
          return { ok: false, message: `Ingrédient ${i + 1} : unité manquante.` };
        }
      }
      return { ok: true };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // reset previous error
            setErrorMessage("");

            // suppose `ingredients` est un tableau d'objets { name, quantity, unit }
            const check = validateIngredients(ingredientsList);
            if (!check.ok) {
                // afficher erreur via state (et éviter référence à setErrorMessage non définie)
                setErrorMessage(check.message);
                return;
            }

            const dataToSend = new FormData();
            Object.entries(form).forEach(([key, value]) => {
                if (key !== "image") dataToSend.append(key, value);
            });

            if (imageFile) dataToSend.append("image", imageFile);
            if (thumbnailFile) dataToSend.append("thumbnail", thumbnailFile);

            dataToSend.append("ingredients", JSON.stringify(ingredientsList));

            const config = {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    "Content-Type": "multipart/form-data"
                }
            };
            if (id) {
                if (window.confirm("Modifier ce cocktail ?")) {
                    await axios.put(`http://localhost:5000/api/cocktails/${id}`, dataToSend, config);
                    alert("Cocktail modifié !");
                }
            } else {
                if (window.confirm("Ajouter ce cocktail ?")) {
                    await axios.post("http://localhost:5000/api/cocktails", dataToSend, config);
                    alert("Cocktail ajouté !");
                }
            }
            navigate("/admin/cocktails");
        } catch (error) {
            processError(error);
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

    return (
        <div className="cocktail-form">
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
                                    <input type="text" className="form-control" name="theme" value={form.theme}
                                           onChange={handleChange} required/>
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
