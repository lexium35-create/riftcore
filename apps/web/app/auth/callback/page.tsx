import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#080b0d",
        color: "#f2f6f7",
        padding: 24,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <Suspense
        fallback={
          <div style={{ maxWidth: 520 }}>
            <p
              style={{
                color: "#82ffc4",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.18em",
              }}
            >
              RIFTCORE / AUTH
            </p>
            <h1 style={{ margin: "12px 0", fontSize: 42 }}>
              Securing session.
            </h1>
          </div>
        }
      >
        <AuthCallbackClient />
      </Suspense>
    </main>
  );
}
