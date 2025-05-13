import axios from 'axios';

const instance = axios.create({
    baseURL: 'http://localhost:5000/api',
});

instance.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default instance;
