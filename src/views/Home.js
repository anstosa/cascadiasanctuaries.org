import "mapbox-gl/dist/mapbox-gl.css";

import React, { useEffect, useRef, useState } from "react";
import Map from "react-map-gl";
import { Loading } from "../components/Loading";
import { Marker } from "../components/Marker";

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoiYmFsbHlkaWRlYW4iLCJhIjoiY2w0ZnhpdmxrMDB4NTNucW5vYzUzcTN3MCJ9.hlyTR3czRK4H_Cs77PQ9jw";
export const SANCTUARIES_API =
  "https://script.google.com/macros/s/AKfycbyM0HLa99-FsTMaRebnTJ-3-2x_fN7JtY8Xoj-lYqxrEorfG6BBzJ1N9gCW_s_z2HmO4g/exec";

export function Home() {
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

  const [searchText, setSearchText] = useState("");
  const [filteredSanctuaries, setFilteredSanctuaries] = useState(sanctuaries);
  useEffect(() => {
    if (searchText) {
      setFilteredSanctuaries(
        sanctuaries.filter((sanctuary) => {
          for (const key in sanctuary) {
            if (
              sanctuary[key] &&
              String(sanctuary[key])
                ?.toLowerCase()
                .includes(searchText.toLowerCase())
            ) {
              return true;
            }
          }
          return false;
        })
      );
    } else {
      setFilteredSanctuaries(sanctuaries);
    }
  }, [sanctuaries, searchText]);

  useEffect(() => {
    if (map?.current && bounds) {
      const padding = Math.min(100, window.innerWidth / 10);
      map.current.fitBounds(bounds, {
        padding: {
          top: 250 + padding,
          bottom: padding,
          left: padding,
          right: padding,
        },
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
          maxWidth: 650,
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
          <span style={{ textTransform: "uppercase" }}>Cascadia</span>
        </h1>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
          Your guide to all the farm sanctuaries in the pacific northwest (WA,
          OR, BC, ID, and MT)
        </p>
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
        <div
          style={{
            position: "absolute",
            bottom: -45,
            left: -1,
          }}
        >
          <input
            type="text"
            placeholder="Search by name"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{
              padding: 6,
              borderRadius: 4,
              width: 200,
              border: "2px solid white",
              backgroundColor: "#e5e9e2",
              boxShadow: "0px 0px 5px rgba(0, 0, 0, 0.3)",
            }}
          />
        </div>
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
        onClick={() => setSelected(null)}
      >
        {sanctuaries === null && <Loading />}
        {filteredSanctuaries?.map((sanctuary) => (
          <Marker
            selected={sanctuary === selected}
            searching={searchText !== ""}
            sanctuary={sanctuary}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              setSelected(sanctuary);
            }}
          />
        ))}
      </Map>
    </div>
  );
}
