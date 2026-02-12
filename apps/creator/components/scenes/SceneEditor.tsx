"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getOrganizationBrands,
  getOrganizationEvents,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type OrganizationId,
  type BrandDocument,
  type EventDocument,
} from "@brayford/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ModuleInstance, ModuleType } from "@brayford/core";
import { v4 as uuidv4 } from "uuid";

// Available module types with metadata
interface ModuleTypeDefinition {
  type: ModuleType;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const AVAILABLE_MODULE_TYPES: ModuleTypeDefinition[] = [
  {
    type: "text",
    name: "Text",
    description: "Display text content",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h7"
        />
      </svg>
    ),
  },
];

interface SceneEditorProps {
  sceneId?: string;
  initialName?: string;
  initialDescription?: string;
  initialModules?: ModuleInstance[];
  initialBrandId?: string | null;
  initialEventId?: string | null;
  organizationId: string;
  onSave: (data: {
    name: string;
    description?: string;
    brandId: string | null;
    eventId: string | null;
    modules: ModuleInstance[];
  }) => Promise<void>;
  onCancel: () => void;
}

// Module palette item component (left column - draggable but not sortable)
interface ModulePaletteItemProps {
  moduleType: ModuleTypeDefinition;
  onAdd: (type: ModuleType) => void;
}

function ModulePaletteItem({ moduleType, onAdd }: ModulePaletteItemProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
          {moduleType.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">
            {moduleType.name}
          </h4>
          <p className="text-xs text-gray-600 mt-0.5">
            {moduleType.description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(moduleType.type)}
        className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
      >
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add to Scene
      </button>
    </div>
  );
}

// Scene canvas module item (right column - sortable)
interface SortableModuleItemProps {
  module: ModuleInstance;
  onEdit: (module: ModuleInstance) => void;
  onDelete: (moduleId: string) => void;
}

function SortableModuleItem({
  module,
  onEdit,
  onDelete,
}: SortableModuleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>

        {/* Module content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
              Text
            </span>
            <span className="text-xs text-gray-500">Order: {module.order}</span>
          </div>
          <p className="text-sm text-gray-900 truncate">
            {(module.config as { content?: string }).content || "(No content)"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(module)}
            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(module.id)}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SceneEditor({
  sceneId,
  initialName = "",
  initialDescription = "",
  initialModules = [],
  initialBrandId = null,
  initialEventId = null,
  organizationId,
  onSave,
  onCancel,
}: SceneEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [modules, setModules] = useState<ModuleInstance[]>(initialModules);
  const [brandId, setBrandId] = useState<string | null>(initialBrandId);
  const [eventId, setEventId] = useState<string | null>(initialEventId);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [editingModule, setEditingModule] = useState<ModuleInstance | null>(
    null,
  );
  const [textContent, setTextContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch brands for the organisation
  useEffect(() => {
    async function loadBrands() {
      try {
        const orgId = toBranded<OrganizationId>(organizationId);
        const orgBrands = await getOrganizationBrands(orgId, true);
        setBrands(orgBrands);
      } catch (error) {
        console.error("Error loading brands:", error);
      }
    }
    loadBrands();
  }, [organizationId]);

  // Fetch events for the organisation, filtered by brand in the UI
  useEffect(() => {
    async function loadEvents() {
      try {
        const orgId = toBranded<OrganizationId>(organizationId);
        const orgEvents = await getOrganizationEvents(orgId, true);
        setEvents(orgEvents);
      } catch (error) {
        console.error("Error loading events:", error);
      }
    }
    loadEvents();
  }, [organizationId]);

  // Filter events by selected brand
  const filteredEvents = useMemo(() => {
    if (!brandId) return [];
    return events.filter((e) => fromBranded(e.brandId) === brandId);
  }, [events, brandId]);

  // Clear event selection when brand changes
  const handleBrandChange = useCallback((newBrandId: string) => {
    const value = newBrandId || null;
    setBrandId(value);
    setEventId(null);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newArray = arrayMove(items, oldIndex, newIndex);
        // Update order values
        return newArray.map((item, index) => ({
          ...item,
          order: index * 10,
        }));
      });
    }
  }, []);

  const handleAddModuleToScene = useCallback(
    (moduleType: ModuleType) => {
      const newModule: ModuleInstance = {
        id: uuidv4(),
        moduleType,
        order: modules.length * 10,
        config: { content: "" },
      };
      // Immediately open editor for the new module
      setEditingModule(newModule);
      setTextContent("");
    },
    [modules.length],
  );

  const handleEditModule = useCallback((module: ModuleInstance) => {
    setEditingModule(module);
    setTextContent((module.config as { content?: string }).content || "");
  }, []);

  const handleSaveModule = useCallback(() => {
    if (!editingModule) return;

    const updatedModule: ModuleInstance = {
      ...editingModule,
      config: { content: textContent },
    };

    setModules((prev) => {
      const existing = prev.find((m) => m.id === editingModule.id);
      if (existing) {
        return prev.map((m) => (m.id === editingModule.id ? updatedModule : m));
      } else {
        return [...prev, updatedModule];
      }
    });

    setEditingModule(null);
    setTextContent("");
  }, [editingModule, textContent]);

  const handleDeleteModule = useCallback((moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter a scene name");
      return;
    }

    setIsSaving(true);
    try {
      const [result] = await Promise.all([
        onSave({
          name: name.trim(),
          description: description.trim() || undefined,
          brandId,
          eventId,
          modules,
        }),
        // Minimum 600ms saving state for visual feedback
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } catch (error) {
      console.error("Error saving scene:", error);
      alert("Failed to save scene");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Scene settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Scene Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="scene-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Scene Name *
            </label>
            <input
              type="text"
              id="scene-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
              placeholder="e.g., Welcome Screen, Q&A Session, Poll #1"
              required
            />
          </div>
          <div>
            <label
              htmlFor="scene-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description (Optional)
            </label>
            <textarea
              id="scene-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
              placeholder="Notes about this scene..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="scene-brand"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Brand (Optional)
              </label>
              <select
                id="scene-brand"
                value={brandId || ""}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
              >
                <option value="">Organisation-wide</option>
                {brands.map((brand) => (
                  <option
                    key={fromBranded(brand.id)}
                    value={fromBranded(brand.id)}
                  >
                    {brand.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to make this scene available across the whole
                organisation
              </p>
            </div>
            <div>
              <label
                htmlFor="scene-event"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Event (Optional)
              </label>
              <select
                id="scene-event"
                value={eventId || ""}
                onChange={(e) => setEventId(e.target.value || null)}
                disabled={!brandId}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {brandId
                    ? "All events for this brand"
                    : "Select a brand first"}
                </option>
                {filteredEvents.map((event) => (
                  <option
                    key={fromBranded(event.id)}
                    value={fromBranded(event.id)}
                  >
                    {event.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Optionally limit this scene to a specific event
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column module builder */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Scene Builder
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Module palette */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Available Modules
            </h4>
            <div className="space-y-3">
              {AVAILABLE_MODULE_TYPES.map((moduleType) => (
                <ModulePaletteItem
                  key={moduleType.type}
                  moduleType={moduleType}
                  onAdd={handleAddModuleToScene}
                />
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Tip:</span> Click "Add to Scene"
                to insert a module into your scene. You can reorder modules by
                dragging them in the scene canvas.
              </p>
            </div>
          </div>

          {/* Right column: Scene canvas */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Scene Canvas
              {modules.length > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  ({modules.length}{" "}
                  {modules.length === 1 ? "module" : "modules"})
                </span>
              )}
            </h4>
            {modules.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm text-gray-600 font-medium">
                  No modules in scene yet
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Add modules from the palette to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={modules.map((m) => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {modules.map((module) => (
                      <SortableModuleItem
                        key={module.id}
                        module={module}
                        onEdit={handleEditModule}
                        onDelete={handleDeleteModule}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : sceneId ? "Update Scene" : "Create Scene"}
        </button>
      </div>

      {/* Module editor modal */}
      {editingModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingModule.moduleType === "text"
                ? "Edit Text Module"
                : "Edit Module"}
            </h3>
            <div className="mb-6">
              <label
                htmlFor="module-content"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Content
              </label>
              <textarea
                id="module-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                placeholder="Enter your text content here..."
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingModule(null);
                  setTextContent("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModule}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Save Module
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
