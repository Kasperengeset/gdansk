"use client";

import dynamic from "next/dynamic";

// Leaflet trenger `window`, så kartene lastes bare i nettleseren.
const loading = () => <div className="h-80 w-full animate-pulse rounded-lg bg-paper" />;

export const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), { ssr: false, loading });
export const PostsMap = dynamic(() => import("./MapPicker").then((m) => m.PostsMap), { ssr: false, loading });
