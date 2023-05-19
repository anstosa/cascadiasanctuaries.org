import React, { useEffect, useState } from "react";
import { SANCTUARIES_API } from "./Home";

export function Emails() {
  const [sanctuaries, setSanctuaries] = useState(null);

  useEffect(() => {
    (async () => {
      const response = await fetch(SANCTUARIES_API);
      const data = await response.json();
      setSanctuaries(data);
    })();
  }, []);

  const emails =
    sanctuaries?.map((sanctuary) => sanctuary.email)?.filter(Boolean) ?? [];

  return (
    <div style={{ padding: 20 }}>
      {emails.length ? emails.join(", ") : "Loading..."}
    </div>
  );
}
