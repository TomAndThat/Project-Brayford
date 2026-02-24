"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@brayford/firebase-utils";
import { clsx } from "clsx";

interface OrgRow {
  id: string;
  name: string;
  billingMethod: string;
  billingTier: string;
  type: string;
  createdAt: Date | null;
  softDeletedAt: Date | null;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BillingMethodBadge({ value }: { value: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        value === "enterprise"
          ? "bg-violet-50 text-violet-700"
          : "bg-sky-50 text-sky-700",
      )}
    >
      {value === "enterprise" ? "Enterprise" : "Self-serve"}
    </span>
  );
}

function StatusBadge({ softDeleted }: { softDeleted: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        softDeleted
          ? "bg-red-50 text-red-600"
          : "bg-emerald-50 text-emerald-700",
      )}
    >
      {softDeleted ? "Deleted" : "Active"}
    </span>
  );
}

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const q = query(
          collection(db, "organizations"),
          orderBy("createdAt", "desc"),
        );
        const snapshot = await getDocs(q);

        const rows: OrgRow[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name ?? "—",
            billingMethod: data.billingMethod ?? "enterprise",
            billingTier: data.billingTier ?? "flat_rate",
            type: data.type ?? "—",
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toDate()
                : null,
            softDeletedAt:
              data.softDeletedAt instanceof Timestamp
                ? data.softDeletedAt.toDate()
                : null,
          };
        });

        setOrgs(rows);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load organisations.",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchOrgs();
  }, []);

  const filtered = orgs.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Organisations
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            All provisioned organisations across Project Brayford.
          </p>
        </div>
        <Link
          href="/organisations/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          New organisation
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            Loading…
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm text-red-500">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            {search
              ? "No organisations match your search."
              : "No organisations yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-500">
                  Billing method
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500">
                  Billing tier
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500">Type</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Created</th>
                <th className="px-4 py-3 font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((org) => (
                <tr key={org.id} className="transition-colors hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link
                      href={`/organisations/${org.id}`}
                      className="hover:underline"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <BillingMethodBadge value={org.billingMethod} />
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">
                    {org.billingTier === "per_brand"
                      ? "Per brand"
                      : "Flat rate"}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">
                    {org.type}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(org.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge softDeleted={!!org.softDeletedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && (
        <p className="mt-3 text-xs text-zinc-400">
          {filtered.length} organisation{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </p>
      )}
    </div>
  );
}
