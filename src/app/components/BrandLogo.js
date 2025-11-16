"use client";

import Image from "next/image";

export default function BrandLogo({ className = "" }) {
  const classes = ["brand-name", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <Image
        src="/headericon.PNG"
        alt="SaveOurFoods logo"
        width={350}
        height={150}
        className="logo"
        priority
      />
    </div>
  );
}
