import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'google-maps-script';

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      if (window.google?.maps?.places) { resolve(); return; }
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

interface PlaceResult {
  name: string;
  mapsUrl: string;
}

export function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement>,
  onSelect: (result: PlaceResult) => void,
  enabled = false,
) {
  const [ready, setReady] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  // Load the script once
  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMapsScript(apiKey)
      .then(() => setReady(true))
      .catch(() => {});
  }, [apiKey]);

  // Attach autocomplete whenever the dialog opens and the input is mounted
  useEffect(() => {
    if (!ready || !enabled || !inputRef.current) return;
    // Destroy previous instance so it re-attaches to the freshly mounted input
    autocompleteRef.current = null;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['name', 'formatted_address', 'place_id', 'url'],
      types: ['establishment', 'geocode'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const name = place.name
        ? `${place.name}${place.formatted_address ? ', ' + place.formatted_address : ''}`
        : (place.formatted_address ?? '');
      const mapsUrl = place.url ?? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
      onSelect({ name, mapsUrl });
    });
    autocompleteRef.current = ac;
  }, [ready, enabled, inputRef, onSelect]);
}
