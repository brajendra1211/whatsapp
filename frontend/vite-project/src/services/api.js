import axios from "axios";

const API = axios.create({
 baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api",
});

API.interceptors.request.use((req)=>{

 const token = localStorage.getItem("token") || sessionStorage.getItem("token");

 if(token){
  req.headers.Authorization = `Bearer ${token}`;
 }

 return req;

});

API.interceptors.response.use(
 (response) => response,
 (error) => {
  if (error?.response?.status === 401) {
   localStorage.removeItem("token");
   localStorage.removeItem("user");
   sessionStorage.removeItem("token");
   sessionStorage.removeItem("user");

   if (window.location.pathname !== "/") {
    window.location.href = "/";
   }
  }

  return Promise.reject(error);
 }
);

export default API;
