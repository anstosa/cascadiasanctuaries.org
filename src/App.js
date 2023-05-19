import "./css/App.css";
import "mapbox-gl/dist/mapbox-gl.css";

import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./views/Home";
import { Emails } from "./views/Emails";

export function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Home />,
    },
    {
      path: "/emails",
      element: <Emails />,
    },
  ]);

  return <RouterProvider router={router} />;
}
