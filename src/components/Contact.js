import React from "react";

const ICON_STYLE = {
  height: 16,
  width: 20,
  padding: 5,
};

export function Contact({ value, link, Icon, text }) {
  if (!value) {
    return null;
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        gap: 4,
        alignItems: "center",
        color: "#427e43",
        fontWeight: "bold",
        textDecoration: "none",
      }}
    >
      <Icon style={ICON_STYLE} /> {text}
    </a>
  );
}
