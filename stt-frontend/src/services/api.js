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
export const registerUser = (data) => API.post("/api/auth/register", data);
export const loginUser    = (data) => API.post("/api/auth/login", data);

// ─── SPEECH APIs ──────────────────────────────────────
export const uploadAudio       = (formData) => API.post("/api/speech/upload", formData);
export const getHistory        = ()         => API.get("/api/speech/history");
export const getTranscriptById = (id)       => API.get(`/api/speech/${id}`);
export const deleteTranscript  = (id)       => API.delete(`/api/speech/${id}`);
export const generateSummary = (data) => API.post("/api/speech/summary", data);
