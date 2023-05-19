import React from "react";

export function Loading() {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.2)",
        bottom: 0,
        color: "white",
        display: "flex",
        fontSize: "2rem",
        justifyContent: "center",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      }}
    >
      <h1>Loading...</h1>
    </div>
  );
}
