import "./App.css";
import "mapbox-gl/dist/mapbox-gl.css";

import React, { useEffect, useRef, useState } from "react";
import Map, { Popup, Marker } from "react-map-gl";
import { ReactComponent as Heart } from "./heart.svg";
import { ReactComponent as Website } from "./earth-americas-solid.svg";
import { ReactComponent as Facebook } from "./facebook-f-brands.svg";
import { ReactComponent as Instagram } from "./instagram-brands.svg";
import { ReactComponent as Twitter } from "./twitter-brands.svg";
import { ReactComponent as TikTok } from "./tiktok-brands.svg";
import { ReactComponent as YouTube } from "./youtube-brands.svg";

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoiYmFsbHlkaWRlYW4iLCJhIjoiY2w0ZnhpdmxrMDB4NTNucW5vYzUzcTN3MCJ9.hlyTR3czRK4H_Cs77PQ9jw";
const SANCTUARIES_API =
  "https://script.google.com/macros/s/AKfycbyM0HLa99-FsTMaRebnTJ-3-2x_fN7JtY8Xoj-lYqxrEorfG6BBzJ1N9gCW_s_z2HmO4g/exec";

const ICON_STYLE = {
  height: 16,
  padding: 5,
};

function App() {
  const [bounds, setBounds] = useState(null);
  const [sanctuaries, setSanctuaries] = useState(null);
  const [selected, setSelected] = useState(null);
  const map = useRef();

  useEffect(() => {
    (async () => {
      const response = await fetch(SANCTUARIES_API);
      const data = await response.json();
      setSanctuaries(data);

      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      data.forEach((sanctuary) => {
        minLng = Math.min(minLng, sanctuary.longitude);
        maxLng = Math.max(maxLng, sanctuary.longitude);
        minLat = Math.min(minLat, sanctuary.latitude);
        maxLat = Math.max(maxLat, sanctuary.latitude);
      });

      setBounds([
        [minLng, maxLat],
        [maxLng, minLat],
      ]);
    })();
  }, []);

  useEffect(() => {
    if (map?.current && bounds) {
      const padding = Math.min(100, window.innerWidth / 10);
      map.current.fitBounds(bounds, {
        padding: { top: 250 + padding, bottom: padding, left: padding, right: padding },
      });
    }
  }, [bounds]);

  return (
    <div className="App">
      <div
        style={{
          position: "fixed",
          zIndex: 999,
          left: 20,
          top: 20,
          right: 20,
          padding: 20,
          border: "2px solid white",
          borderRadius: 4,
          color: "white",
          backgroundColor: "#387e46",
          boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h1 style={{ margin: 0, textAlign: "center", fontSize: "4rem" }}>
          <span style={{ fontSize: "1rem", display: "block" }}>
            farm sanctuaries of
          </span>{" "}
          <span style={{textTransform: "uppercase"}}>Cascadia</span>
        </h1>
        <p style={{ textAlign: "center" }}>
          <a
            href="https://ballydidean.farm/store/cascadia-sanctuaries"
            target="_blank"
            rel="noopenner noreferrer"
            style={{ color: "white" }}
          >
            Buy the merch to support ALL these sanctuaries!
          </a>
        </p>
        <em
          style={{
            textAlign: "center",
            display: "block",
            fontSize: "0.75rem",
            marginTop: 20,
            opacity: 0.5,
          }}
        >
          Built with love by{" "}
          <a href="https://ballydidean.farm" style={{ color: "white" }}>
            Ballydídean
          </a>
        </em>
      </div>
      <Map
        ref={map}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        mapStyle="mapbox://styles/ballydidean/cl4g0hdoa000215oaftbyye60"
        initialViewState={{
          longitude: -120.00904832421938,
          latitude: 46.66503828572355,
          zoom: 5,
        }}
        style={{
          height: "100vh",
          width: "100vw",
        }}
      >
        {sanctuaries?.map((sanctuary) => (
          <Marker
            key={sanctuary.name}
            longitude={sanctuary.longitude}
            latitude={sanctuary.latitude}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              setSelected(sanctuary);
            }}
          >
            <Heart
              style={{
                width: 24,
                height: 24,
                color: sanctuary === selected ? "#5FA8CD" : "#7FDA91",
                boxShadow: "0 0 -2px 0 white",
                cursor: "pointer",
              }}
            />
          </Marker>
        ))}
        {selected && (
          <Popup
            offset={[0, -5]}
            longitude={selected.longitude}
            latitude={selected.latitude}
            onClose={() => setSelected(null)}
          >
            <h3>{selected.name}</h3>
            <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
              {selected.website && (
                <a
                  href={`http://${selected.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Website style={ICON_STYLE} />
                </a>
              )}
              {selected.facebook && (
                <a
                  href={`https://facebook.com/${selected.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Facebook style={ICON_STYLE} />
                </a>
              )}
              {selected.instagram && (
                <a
                  href={`https://instagram.com/${selected.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram style={ICON_STYLE} />
                </a>
              )}
              {selected.twitter && (
                <a
                  href={`https://twitter.com/${selected.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Twitter style={ICON_STYLE} />
                </a>
              )}
              {selected.youtube && (
                <a
                  href={selected.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <YouTube style={ICON_STYLE} />
                </a>
              )}
              {selected.tiktok && (
                <a
                  href={`https://tiktok.com/@${selected.tiktok}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TikTok style={ICON_STYLE} />
                </a>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

export default App;
