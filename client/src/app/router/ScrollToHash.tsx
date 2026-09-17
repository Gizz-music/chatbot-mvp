import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToHash = () => {
  const { hash, pathname } = useLocation();

  useLayoutEffect(() => {
    if (!hash) {
      return;
    }

    const id = decodeURIComponent(hash.replace(/^#/, ""));

    const scroll = () => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

    scroll();
    const frame = window.requestAnimationFrame(scroll);
    const timer = window.setTimeout(scroll, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [hash, pathname]);

  return null;
};
