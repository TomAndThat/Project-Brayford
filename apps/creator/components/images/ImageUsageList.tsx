"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrand, getScene } from "@brayford/firebase-utils";
import { toBranded, type BrandId, type SceneId } from "@brayford/core";

interface ResolvedReference {
  id: string;
  name: string;
  type: "brand" | "scene";
}

interface ImageUsageListProps {
  usedBy: {
    brands: string[];
    scenes: string[];
  };
}

/**
 * Resolves and displays a list of brands and scenes that reference an image.
 *
 * Each item is a link to the corresponding detail page.
 */
export default function ImageUsageList({ usedBy }: ImageUsageListProps) {
  const [references, setReferences] = useState<ResolvedReference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveReferences(): Promise<void> {
      const resolved: ResolvedReference[] = [];

      const brandPromises = usedBy.brands.map(async (id) => {
        try {
          const brand = await getBrand(toBranded<BrandId>(id));
          if (brand) {
            return { id, name: brand.name, type: "brand" as const };
          }
          return { id, name: id, type: "brand" as const };
        } catch {
          return { id, name: id, type: "brand" as const };
        }
      });

      const scenePromises = usedBy.scenes.map(async (id) => {
        try {
          const scene = await getScene(toBranded<SceneId>(id));
          if (scene) {
            return { id, name: scene.name, type: "scene" as const };
          }
          return { id, name: id, type: "scene" as const };
        } catch {
          return { id, name: id, type: "scene" as const };
        }
      });

      const results = await Promise.all([...brandPromises, ...scenePromises]);

      if (!cancelled) {
        setReferences(results);
        setLoading(false);
      }
    }

    resolveReferences();

    return () => {
      cancelled = true;
    };
  }, [usedBy]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading references...</div>;
  }

  if (references.length === 0) {
    return <div className="text-sm text-gray-500">No references found.</div>;
  }

  return (
    <ul className="space-y-2">
      {references.map((ref) => (
        <li key={`${ref.type}-${ref.id}`}>
          <Link
            href={
              ref.type === "brand"
                ? `/dashboard/brands/${ref.id}`
                : `/dashboard/scenes/${ref.id}`
            }
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                ref.type === "brand"
                  ? "bg-purple-50 text-purple-700"
                  : "bg-teal-50 text-teal-700"
              }`}
            >
              {ref.type === "brand" ? "Brand" : "Scene"}
            </span>
            <span className="truncate">{ref.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
