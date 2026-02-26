"use client";

import { useRouter } from "next/navigation";
import { fromBranded, type BrandDocument, type BrandId } from "@brayford/core";

interface BrandsTableProps {
  filteredBrands: BrandDocument[];
  allBrands: BrandDocument[];
  canCreate: boolean;
  canUpdate: boolean;
  restoringBrandId: string | null;
  filterLabel: string;
  onCreateBrand: () => void;
  onRestoreBrand: (brandId: BrandId) => void;
}

export default function BrandsTable({
  filteredBrands,
  allBrands,
  canCreate,
  canUpdate,
  restoringBrandId,
  filterLabel,
  onCreateBrand,
  onRestoreBrand,
}: BrandsTableProps) {
  const router = useRouter();

  // ── No brands at all ────────────────────────────────────────────────
  if (filteredBrands.length === 0 && allBrands.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No brands yet
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Create your first brand to start managing events.
          </p>
          {canCreate && (
            <button
              onClick={onCreateBrand}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Your First Brand
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Filter returned no results ──────────────────────────────────────
  if (filteredBrands.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No {filterLabel} brands
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {filterLabel === "active"
              ? "All brands are currently archived."
              : "No archived brands found."}
          </p>
        </div>
      </div>
    );
  }

  // ── Brands table ────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Brand
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredBrands.map((brand) => {
            const isRestoring = restoringBrandId === fromBranded(brand.id);

            return (
              <tr
                key={fromBranded(brand.id)}
                className={`hover:bg-gray-50 cursor-pointer ${
                  !brand.isActive ? "opacity-60" : ""
                }`}
                onClick={() =>
                  router.push(`/dashboard/brands/${fromBranded(brand.id)}`)
                }
              >
                {/* Brand Info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-lg">
                        {brand.name[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {brand.name}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {brand.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      brand.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {brand.isActive ? "Active" : "Archived"}
                  </span>
                </td>

                {/* Actions */}
                <td
                  className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-3">
                    {!brand.isActive && canUpdate && (
                      <button
                        onClick={() => onRestoreBrand(brand.id)}
                        disabled={isRestoring}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRestoring ? "Restoring..." : "Restore"}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        router.push(
                          `/dashboard/brands/${fromBranded(brand.id)}`,
                        )
                      }
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Manage
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
