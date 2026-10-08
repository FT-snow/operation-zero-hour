"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Markers used by the landing page:
//   [data-reveal]      fade-up batch reveal on enter
//   [data-line-draw]   hairline draws itself via scrub
//   [data-drift]       slow parallax drift on oversized numerals
// Hooks run globally for this route; components unmount with the page.
export default function GsapScroller() {
  useGSAP(() => {
    gsap.set("[data-reveal]", { opacity: 0, y: 14 });
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.09,
          ease: "power3.out",
          overwrite: true,
        }),
    });

    gsap.utils.toArray<HTMLElement>("[data-line-draw]").forEach((line) => {
      gsap.fromTo(
        line,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: line, start: "top 92%", end: "top 45%", scrub: 0.6 },
        }
      );
    });

    gsap.utils.toArray<HTMLElement>("[data-drift]").forEach((el) => {
      gsap.to(el, {
        yPercent: -18,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    });
  });

  return null;
}
