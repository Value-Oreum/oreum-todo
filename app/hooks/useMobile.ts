"use client";
import { useEffect, useState } from "react";
export const MOBILE_QUERY =
  "(max-width:760px), (max-width:1024px) and (max-height:500px) and (pointer:coarse)";
export function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = matchMedia(MOBILE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}
