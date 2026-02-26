"use client";

import { MAX_TAGS_PER_IMAGE, MAX_TAG_LENGTH } from "@brayford/core";
import type { UseImageFormReturn } from "@/hooks/use-image-form";

interface ImageMetadataFormProps {
  canEdit: boolean;
  form: Pick<
    UseImageFormReturn,
    | "editName"
    | "setEditName"
    | "editDescription"
    | "setEditDescription"
    | "editTags"
    | "newTag"
    | "setNewTag"
    | "isSaving"
    | "handleSave"
    | "handleAddTag"
    | "handleRemoveTag"
  >;
}

export default function ImageMetadataForm({
  canEdit,
  form,
}: ImageMetadataFormProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Image Metadata
      </h3>

      {/* Name */}
      <div className="mb-4">
        <label
          htmlFor="image-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <input
          type="text"
          id="image-name"
          value={form.editName}
          onChange={(e) => form.setEditName(e.target.value)}
          disabled={!canEdit}
          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label
          htmlFor="image-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="image-description"
          value={form.editDescription}
          onChange={(e) => form.setEditDescription(e.target.value)}
          disabled={!canEdit}
          rows={3}
          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="Optional description..."
        />
      </div>

      {/* Tags */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags ({form.editTags.length}/{MAX_TAGS_PER_IMAGE})
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {form.editTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
            >
              {tag}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => form.handleRemoveTag(tag)}
                  className="ml-1 text-blue-400 hover:text-blue-600"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && form.editTags.length < MAX_TAGS_PER_IMAGE && (
          <div className="flex gap-2">
            <input
              type="text"
              value={form.newTag}
              onChange={(e) => form.setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  form.handleAddTag();
                }
              }}
              placeholder="Add a tag..."
              maxLength={MAX_TAG_LENGTH}
              className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={form.handleAddTag}
              className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Save button */}
      {canEdit && (
        <button
          onClick={form.handleSave}
          disabled={form.isSaving || !form.editName.trim()}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {form.isSaving ? "Saving..." : "Save Changes"}
        </button>
      )}
    </div>
  );
}
