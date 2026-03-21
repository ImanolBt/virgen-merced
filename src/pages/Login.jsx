import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    console.log("LOGIN data:", data);
    console.log("LOGIN error:", error);

    setLoading(false);

    if (error) {
      setErrorMsg("Correo o contraseña incorrectos");
      return;
    }
    // App.jsx detecta sesión automáticamente
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 10%, rgba(150,179,74,.25), transparent 40%), radial-gradient(circle at 80% 30%, rgba(122,166,60,.18), transparent 45%), #f4f7f3",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        className="mm-card"
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 18px 45px rgba(0,0,0,.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(90deg, #96b34a, #7aa63c)",
            color: "white",
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900 }}>Virgen de la Merced</div>
          <div style={{ fontSize: 13, opacity: 0.95 }}>
            Sistema de gestión médica
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Correo</label>
            <input
              className="mm-input"
              placeholder="ej: medico@virgen-merced.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Contraseña</label>
            <input
              type="password"
              className="mm-input"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={loading}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                background: "rgba(220,38,38,.1)",
                color: "#991b1b",
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            className="mm-btn"
            onClick={handleLogin}
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "12px",
              borderRadius: 14,
              fontWeight: 900,
            }}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
            Acceso exclusivo para personal autorizado.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
        © {new Date().getFullYear()} Virgen de la Merced
      </div>
    </div>
  );
}
