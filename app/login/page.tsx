"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import BogButton from "@/components/BogButton/BogButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      await authClient.signIn.email(
        { email, password },
        {
          onSuccess: () => router.push("/profile"),
          onError: (ctx) =>
            setError(ctx.error.message ?? "Invalid email or password."),
        },
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ width: "100%", maxWidth: 340, padding: "0 24px" }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 32,
            color: "#111",
          }}
        >
          Sign in
        </h1>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{
            width: "100%",
            padding: "12px 0",
            fontSize: 15,
            border: "none",
            borderBottom: "1px solid #ddd",
            outline: "none",
            marginBottom: 20,
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: "100%",
            padding: "12px 0",
            fontSize: 15,
            border: "none",
            borderBottom: "1px solid #ddd",
            outline: "none",
            marginBottom: 32,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ fontSize: 13, color: "#c0392b", marginBottom: 16 }}>
            {error}
          </p>
        )}

        <BogButton
          variant="primary"
          size="responsive"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </BogButton>
      </div>
    </div>
  );
}
