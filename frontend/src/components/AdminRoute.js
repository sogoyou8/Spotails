import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from '../axiosConfig';

const AdminRoute = ({ children }) => {
    const [isRoleValid, setIsRoleValid] = useState(true);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");

    useEffect(() => {
        const checkRoleInDatabase = async () => {
            if (token) {
                try {
                    const decodedToken = jwtDecode(token);
                    const res = await axios.get("http://localhost:5000/api/users/me", {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data.role !== decodedToken.role) {
                        localStorage.removeItem("token");
                        localStorage.removeItem("username");
                        setIsRoleValid(false);
                    }
                } catch (err) {
                    console.error("Erreur lors de la vérification du rôle", err);
                } finally {
                    setLoading(false);
                }
            } else {
                setIsRoleValid(false);
                setLoading(false);
            }
        };

        checkRoleInDatabase();
    }, [token]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!token || !isRoleValid) {
        return <Navigate to="/login" />;
    }

    return children;
};

export default AdminRoute;
