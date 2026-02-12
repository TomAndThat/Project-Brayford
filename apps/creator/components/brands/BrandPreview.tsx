"use client";

import type { HeaderType } from "@brayford/core";

export interface BrandPreviewProps {
  /** Page background colour */
  backgroundColor: string;
  /** Page text colour */
  textColor: string;
  /** Which header style is selected */
  headerType: HeaderType;
  /** Profile image URL (for profile mode) */
  profileImageUrl?: string;
  /** Logo image URL (for logo mode) */
  logoImageUrl?: string;
  /** Banner image URL (for banner mode) */
  bannerImageUrl?: string;
  /** Background colour for the header area */
  headerBackgroundColor?: string;
  /** Background image URL for the header area */
  headerBackgroundImageUrl?: string;
}

/**
 * iPhone-frame preview of the audience app, reflecting the current brand styling.
 * Shows the header (profile / logo / banner / none) followed by mock Q&A content.
 */
export default function BrandPreview({
  backgroundColor,
  textColor,
  headerType,
  profileImageUrl,
  logoImageUrl,
  bannerImageUrl,
  headerBackgroundColor,
  headerBackgroundImageUrl,
}: BrandPreviewProps) {
  const headerBgStyle: React.CSSProperties = {
    backgroundColor: headerBackgroundColor || "transparent",
    ...(headerBackgroundImageUrl
      ? {
          backgroundImage: `url(${headerBackgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : {}),
  };

  const renderHeader = () => {
    switch (headerType) {
      case "profile":
        return (
          <div
            className="w-full flex items-center justify-center py-10 px-20"
            style={headerBgStyle}
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt="Profile"
                className="w-full rounded border-2"
                style={{ borderColor: textColor + "40" }}
              />
            ) : (
              <div
                className="w-full aspect-square rounded border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: textColor + "30" }}
              >
                <svg
                  className="w-8 h-8 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>
        );

      case "logo":
        return (
          <div
            className="w-full flex items-center justify-center py-10 px-20"
            style={headerBgStyle}
          >
            {logoImageUrl ? (
              <img
                src={logoImageUrl}
                alt="Logo"
                className="max-w-full max-h-24 object-contain"
              />
            ) : (
              <div
                className="w-full h-16 border-2 border-dashed flex items-center justify-center rounded"
                style={{ borderColor: textColor + "30" }}
              >
                <svg
                  className="w-8 h-8 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>
        );

      case "banner":
        return (
          <div className="w-full" style={headerBgStyle}>
            {bannerImageUrl ? (
              <img
                src={bannerImageUrl}
                alt="Banner"
                className="w-full h-auto"
              />
            ) : (
              <div
                className="w-full h-24 border-b-2 border-dashed flex items-center justify-center"
                style={{ borderColor: textColor + "30" }}
              >
                <svg
                  className="w-8 h-8 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
                  />
                </svg>
              </div>
            )}
          </div>
        );

      case "none":
      default:
        return null;
    }
  };

  return (
    <div className="sticky top-8">
      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
        Preview
      </p>
      {/* iPhone-sized preview frame */}
      <div className="relative">
        {/* Device Frame */}
        <div className="w-[375px] h-[667px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
          {/* Screen */}
          <div
            className="w-full h-full rounded-[2.5rem] overflow-hidden"
            style={{ backgroundColor, color: textColor }}
          >
            {/* Mock audience app content */}
            <div className="h-full flex flex-col overflow-hidden">
              {/* Brand Header */}
              {renderHeader()}

              {/* Event header */}
              <div
                className="p-6 border-b flex-shrink-0"
                style={{ borderColor: textColor + "20" }}
              >
                <h1 className="text-2xl font-bold mb-2">Event Name</h1>
                <p className="text-sm opacity-75">Live Q&A Session</p>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6 space-y-4 overflow-hidden">
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: textColor + "10" }}
                >
                  <p className="text-sm font-medium mb-1">
                    Question from audience
                  </p>
                  <p className="text-xs opacity-75">
                    What&apos;s your favourite feature?
                  </p>
                </div>
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: textColor + "10" }}
                >
                  <p className="text-sm font-medium mb-1">
                    Question from audience
                  </p>
                  <p className="text-xs opacity-75">How did you get started?</p>
                </div>
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: textColor + "10" }}
                >
                  <p className="text-sm font-medium mb-1">
                    Question from audience
                  </p>
                  <p className="text-xs opacity-75">
                    What&apos;s next for the platform?
                  </p>
                </div>
              </div>

              {/* Bottom Input */}
              <div
                className="p-6 border-t flex-shrink-0"
                style={{ borderColor: textColor + "20" }}
              >
                <div className="flex gap-2">
                  <div
                    className="flex-1 p-3 rounded-lg border"
                    style={{ borderColor: textColor + "30" }}
                  >
                    <p className="text-sm opacity-50">Ask a question...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl" />
      </div>
    </div>
  );
}
