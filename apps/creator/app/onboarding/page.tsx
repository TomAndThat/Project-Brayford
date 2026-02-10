"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { getUserOrganizations } from "@brayford/firebase-utils";
import { type OrganizationType, toBranded, type UserId } from "@brayford/core";

interface OnboardingFormData {
  organizationName: string;
  organizationType: OrganizationType;
  billingEmail: string;
}

export default function OnboardingPage() {
  const { user, loading: authLoading, signOut: handleSignOut } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [selectedType, setSelectedType] = useState<
    "individual" | "organization" | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<OnboardingFormData>();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      setValue("billingEmail", user.email || "");
      checkExistingOrganization();
    }
  }, [user, authLoading, router, setValue]);

  // Pre-fill organization name when type is selected
  useEffect(() => {
    if (selectedType === "individual" && user?.displayName) {
      setValue("organizationName", user.displayName);
    } else if (selectedType === "organization") {
      setValue("organizationName", "");
    }
  }, [selectedType, user, setValue]);

  const checkExistingOrganization = async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length > 0) {
        // User already has organization, skip onboarding
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error checking existing organization:", error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      const userId = toBranded<UserId>(user.uid);

      // Map UI selection to schema type
      // 'individual' stays as-is; 'organization' maps to 'team'
      const orgType: OrganizationType =
        selectedType === "individual" ? "individual" : "team";

      // Create organisation via server-side API route (atomic batch write)
      const idToken = await user.getIdToken();
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: data.organizationName,
          type: orgType,
          billingEmail: data.billingEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create organisation");
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Onboarding error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to create organisation: ${errorMessage}`);
      setIsSubmitting(false);
    }
  };

  if (authLoading || checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to Project Brayford
          </h1>
          <p className="mt-2 text-gray-600">Let's get you set up</p>
        </div>

        {/* Form Card */}
        <div className="bg-white py-8 px-8 shadow-lg rounded-lg">
          {!selectedType ? (
            /* Step 1: Choose type */
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 text-center mb-6">
                Which of these best describes you?
              </h2>

              <button
                type="button"
                onClick={() => setSelectedType("individual")}
                data-testid="onboarding-type-individual"
                className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="font-semibold text-lg text-gray-900">
                  Individual Creator
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  You're a solo creator, or an independent team working on one
                  project
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType("organization")}
                data-testid="onboarding-type-organisation"
                className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="font-semibold text-lg text-gray-900">
                  Organisation
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  You're part of a team or company working on multiple projects
                  (like a production company or broadcaster)
                </div>
              </button>
            </div>
          ) : (
            /* Step 2: Organization details form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                data-testid="onboarding-back-btn"
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                ← Back
              </button>

              {/* Organization Name */}
              <div>
                <label
                  htmlFor="organizationName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Organisation Name
                </label>
                <input
                  {...register("organizationName", {
                    required: "Organisation name is required",
                    minLength: {
                      value: 1,
                      message: "Organisation name must be at least 1 character",
                    },
                    maxLength: {
                      value: 100,
                      message:
                        "Organisation name must be less than 100 characters",
                    },
                  })}
                  type="text"
                  id="organizationName"
                  data-testid="onboarding-org-name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    selectedType === "individual"
                      ? "e.g., Jane Smith, "
                      : "e.g., Acme Productions"
                  }
                  disabled={isSubmitting}
                />
                {errors.organizationName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.organizationName.message}
                  </p>
                )}
              </div>

              {/* Billing Email */}
              <div>
                <label
                  htmlFor="billingEmail"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Billing Email
                </label>
                <input
                  {...register("billingEmail", {
                    required: "Billing email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  })}
                  type="email"
                  id="billingEmail"
                  data-testid="onboarding-billing-email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="billing@example.com"
                  disabled={isSubmitting}
                />
                {errors.billingEmail && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.billingEmail.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="onboarding-submit-btn"
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting
                  ? "Creating Organisation..."
                  : "Create Organisation"}
              </button>
            </form>
          )}
        </div>

        {/* User Info */}
        <div className="mt-4 text-center text-sm text-gray-500">
          Signed in as {user.email} •{" "}
          <button
            onClick={handleSignOut}
            data-testid="onboarding-signout"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
