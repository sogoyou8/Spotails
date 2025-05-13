export const processError = ( error ) => {
    if (error.response && error.response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "/login";
    } else {
        console.error("Erreur " + error.response?.data?.message || error.message);
    }
};
