import { useEffect, useRef, useState } from "react";

export default function useIntersection(options = { rootMargin: "100px", threshold: 0.01 }) {
  const ref = useRef(null);
  const [intersecting, setIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current || intersecting) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIntersecting(true);
        obs.disconnect();
      }
    }, options);
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [options, intersecting]);

  return { ref, intersecting };
}