import axios from "axios";


// ✅ Points to your Spring Boot backend
const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// ─── Attach JWT token to every request automatically ──
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── AUTH APIs ────────────────────────────────────────
export const registerUser = (data) => API.post("/auth/register", data);
export const loginUser    = (data) => API.post("/auth/login", data);

// ─── SPEECH APIs ──────────────────────────────────────
export const uploadAudio       = (formData) => API.post("/speech/upload", formData);
export const getHistory        = ()         => API.get("/speech/history");
export const getTranscriptById = (id)       => API.get(`/speech/${id}`);
export const deleteTranscript  = (id)       => API.delete(`/speech/${id}`);
export const generateSummary = (data) => API.post("/speech/summary", data);
