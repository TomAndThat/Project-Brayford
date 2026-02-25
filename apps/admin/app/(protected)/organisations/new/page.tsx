"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { extractDomain } from "@brayford/core";
import { useAuth } from "@/contexts/auth";
import { provisionOrganisation } from "@/lib/provision-organisation";

// ===== Form Schema =====

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Organisation name is required")
    .max(100, "Must be 100 characters or fewer"),
  billingEmail: z.string().email("Must be a valid email address"),
  billingMethod: z.enum(["enterprise", "self_serve"]),
  billingTier: z.enum(["per_brand", "flat_rate"]),
  type: z.enum(["individual", "team", "enterprise"]),
  primaryEmailDomain: z.string().min(1, "Domain is required"),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerEmail: z.string().email("Must be a valid email address"),
});

type FormValues = z.infer<typeof formSchema>;

// ===== Sub-components =====

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-zinc-700"
    >
      {children}
      {hint && <span className="ml-1 font-normal text-zinc-400">{hint}</span>}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return [
    "block w-full rounded-md border px-3 py-2 text-sm text-zinc-900",
    "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0",
    hasError
      ? "border-red-300 focus:ring-red-400"
      : "border-zinc-200 focus:ring-zinc-400",
  ].join(" ");
}

function selectClass(hasError: boolean) {
  return inputClass(hasError) + " bg-white";
}

// ===== Page =====

export default function NewOrganisationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      billingMethod: "enterprise",
      billingTier: "flat_rate",
      type: "team",
    },
  });

  // Auto-populate primaryEmailDomain when billingEmail changes
  function handleBillingEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const email = e.target.value;
    const domain = extractDomain(email);
    if (domain) {
      setValue("primaryEmailDomain", domain, { shouldValidate: true });
    }
  }

  async function onSubmit(values: FormValues) {
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await provisionOrganisation({
        name: values.name,
        billingEmail: values.billingEmail,
        billingMethod: values.billingMethod,
        billingTier: values.billingTier,
        type: values.type,
        primaryEmailDomain: values.primaryEmailDomain,
        ownerName: values.ownerName,
        ownerEmail: values.ownerEmail,
        provisionedByUid: user.uid,
        superAdminName:
          user.displayName ?? user.email ?? "Project Brayford Admin",
      });

      router.push("/organisations");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">
          New organisation
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Provision a new organisation and send an invitation to the owner.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* ─── Organisation details ─────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Organisation
          </h2>

          <div className="space-y-5">
            <div>
              <Label htmlFor="name">Organisation name</Label>
              <input
                id="name"
                type="text"
                autoComplete="off"
                className={inputClass(!!errors.name)}
                placeholder="e.g. BBC, Acme Productions"
                {...register("name")}
              />
              <FieldError message={errors.name?.message} />
            </div>

            <div>
              <Label htmlFor="billingEmail">Billing email</Label>
              <input
                id="billingEmail"
                type="email"
                className={inputClass(!!errors.billingEmail)}
                placeholder="billing@example.com"
                {...register("billingEmail", {
                  onBlur: handleBillingEmailBlur,
                })}
              />
              <FieldError message={errors.billingEmail?.message} />
            </div>

            <div>
              <Label
                htmlFor="primaryEmailDomain"
                hint="(auto-filled from billing email)"
              >
                Primary email domain
              </Label>
              <input
                id="primaryEmailDomain"
                type="text"
                className={inputClass(!!errors.primaryEmailDomain)}
                placeholder="example.com"
                {...register("primaryEmailDomain")}
              />
              <FieldError message={errors.primaryEmailDomain?.message} />
            </div>

            <div>
              <Label htmlFor="type">Organisation type</Label>
              <select
                id="type"
                className={selectClass(!!errors.type)}
                {...register("type")}
              >
                <option value="individual">Individual</option>
                <option value="team">Team</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <FieldError message={errors.type?.message} />
            </div>
          </div>
        </section>

        {/* ─── Billing ──────────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Billing
          </h2>

          <div className="space-y-5">
            {/* Billing method */}
            <div>
              <Label htmlFor="billingMethod">Billing method</Label>
              <div className="mt-2 space-y-2">
                {[
                  {
                    value: "enterprise",
                    label: "Enterprise",
                    description: "Invoiced periodically — no card required",
                  },
                  {
                    value: "self_serve",
                    label: "Self-serve",
                    description: "Card on file, charged automatically",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 px-4 py-3 transition-colors has-[:checked]:border-zinc-400 has-[:checked]:bg-zinc-50"
                  >
                    <input
                      type="radio"
                      value={option.value}
                      className="mt-0.5 accent-zinc-900"
                      {...register("billingMethod")}
                    />
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {option.label}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <FieldError message={errors.billingMethod?.message} />
            </div>

            {/* Billing tier */}
            <div>
              <Label htmlFor="billingTier">Billing tier</Label>
              <select
                id="billingTier"
                className={selectClass(!!errors.billingTier)}
                {...register("billingTier")}
              >
                <option value="flat_rate">Flat rate</option>
                <option value="per_brand">Per brand</option>
              </select>
              <p className="mt-1 text-xs text-zinc-400">
                Flat rate is the default for provisioned organisations.
              </p>
              <FieldError message={errors.billingTier?.message} />
            </div>
          </div>
        </section>

        {/* ─── Owner ────────────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Owner invitation
          </h2>
          <p className="mb-5 text-xs text-zinc-400">
            An invitation email will be sent to this person. They will become
            the organisation owner when they accept.
          </p>

          <div className="space-y-5">
            <div>
              <Label htmlFor="ownerName">Owner name</Label>
              <input
                id="ownerName"
                type="text"
                autoComplete="off"
                className={inputClass(!!errors.ownerName)}
                placeholder="Jane Smith"
                {...register("ownerName")}
              />
              <FieldError message={errors.ownerName?.message} />
            </div>

            <div>
              <Label htmlFor="ownerEmail">Owner email</Label>
              <input
                id="ownerEmail"
                type="email"
                className={inputClass(!!errors.ownerEmail)}
                placeholder="jane@example.com"
                {...register("ownerEmail")}
              />
              <FieldError message={errors.ownerEmail?.message} />
            </div>
          </div>
        </section>

        {/* ─── Submit ───────────────────────────────────────────── */}
        {submitError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Provisioning…" : "Create organisation"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/organisations")}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
