import React, { useState } from "react";
import { ReactComponent as Email } from "../images/envelope-solid.svg";
import { ReactComponent as Facebook } from "../images/facebook-f-brands.svg";
import { ReactComponent as Heart } from "../images/heart.svg";
import { ReactComponent as Instagram } from "../images/instagram-brands.svg";
import { ReactComponent as Location } from "../images/location-dot-solid.svg";
import { ReactComponent as Phone } from "../images/phone-solid.svg";
import { ReactComponent as TikTok } from "../images/tiktok-brands.svg";
import { ReactComponent as Twitter } from "../images/twitter-brands.svg";
import { ReactComponent as Website } from "../images/earth-americas-solid.svg";
import { ReactComponent as YouTube } from "../images/youtube-brands.svg";
import { Marker as MapboxMarker } from "react-map-gl";
import { Contact } from "./Contact";

export function Marker({
  selected = false,
  searching = false,
  sanctuary,
  onClick,
}) {
  const [hovered, setHovered] = useState(false);

  if (!sanctuary) {
    return null;
  }

  return (
    <MapboxMarker
      key={sanctuary.name}
      longitude={sanctuary.longitude}
      latitude={sanctuary.latitude}
      anchor="top-left"
      onClick={onClick}
      style={{
        zIndex: hovered ? 999 : selected ? 888 : 1,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          marginLeft: -13,
          marginTop: -13,
          padding: 6,
          ...(selected || hovered || searching
            ? {
                borderRadius: 4,
                backgroundColor: "white",
                boxShadow: "0px 0px 5px rgba(0, 0, 0, 0.3)",
              }
            : {}),
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Heart
            style={{
              width: 24,
              height: 24,
              color: "#7FDA91",
              boxShadow: "0 0 -2px 0 white",
              cursor: "pointer",
            }}
          />
          {(selected || hovered || searching) && (
            <h3 style={{ margin: 0 }}>{sanctuary.name}</h3>
          )}
        </div>
        {selected && (
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <Contact
                value={sanctuary.address}
                link={`https://www.google.com/maps/search/${sanctuary.address}, ${sanctuary.city}, ${sanctuary.state}`}
                Icon={Location}
                text={`${sanctuary.address}, ${sanctuary.city} ${sanctuary.state}`}
              />
              <Contact
                value={sanctuary.website}
                link={`http://${sanctuary.website}`}
                Icon={Website}
                text={sanctuary.website}
              />
              <Contact
                value={sanctuary.email}
                link={`mailto:${sanctuary.email}`}
                Icon={Email}
                text={sanctuary.email}
              />
              <Contact
                value={sanctuary.phone}
                link={`tel:+1${sanctuary.phone}`}
                Icon={Phone}
                text={
                  sanctuary.phone
                    ? `(${String(sanctuary.phone).slice(0, 3)}) ${String(
                        sanctuary.phone
                      ).slice(3, 6)}-${String(sanctuary.phone).slice(6, 9)}`
                    : ""
                }
              />
              <Contact
                value={sanctuary.facebook}
                link={`https://facebook.com/${sanctuary.facebook}`}
                Icon={Facebook}
                text={`@${sanctuary.facebook}`}
              />
              <Contact
                value={sanctuary.instagram}
                link={`https://instagram.com/${sanctuary.instagram}`}
                Icon={Instagram}
                text={`@${sanctuary.instagram}`}
              />
              <Contact
                value={sanctuary.twitter}
                link={`https://twitter.com/${sanctuary.twitter}`}
                Icon={Twitter}
                text={`@${sanctuary.twitter}`}
              />
              <Contact
                value={sanctuary.youtube}
                link={sanctuary.youtube}
                Icon={YouTube}
                text="YouTube"
              />
              <Contact
                value={sanctuary.tiktok}
                link={`https://tiktok.com/@${sanctuary.tiktok}`}
                Icon={TikTok}
                text={`@${sanctuary.tiktok}`}
              />
            </div>
          </div>
        )}
      </div>
    </MapboxMarker>
  );
}
