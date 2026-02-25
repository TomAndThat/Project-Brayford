"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";
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
  type MessagingModuleConfig,
  DEFAULT_INPUT_BACKGROUND,
  DEFAULT_INPUT_TEXT,
  DEFAULT_BUTTON_BACKGROUND,
  DEFAULT_BUTTON_TEXT,
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
import type { JSONContent } from "@tiptap/react";
import RichTextEditor from "../shared/RichTextEditor";
import { useToast } from "@/components/shared/Toast";
import ImagePickerDialog, {
  type ImagePickerSelection,
} from "../images/ImagePickerDialog";

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
  {
    type: "image",
    name: "Image",
    description: "Display a full-width image",
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
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    type: "messaging",
    name: "Messaging",
    description: "Let the audience send you a message",
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
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4-1-4z"
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
              {module.moduleType === "text"
                ? "Text"
                : module.moduleType === "messaging"
                  ? "Messaging"
                  : "Image"}
            </span>
          </div>
          {module.moduleType === "text" ? (
            <p className="text-sm text-gray-900 truncate">
              {(module.config as { content?: JSONContent }).content
                ? "Rich text content"
                : "(No content)"}
            </p>
          ) : module.moduleType === "messaging" ? (
            <p className="text-sm text-gray-900 truncate">
              {(module.config as { prompt?: string }).prompt ||
                "(No prompt set)"}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              {(module.config as { url?: string }).url && (
                <img
                  src={(module.config as { url: string }).url}
                  alt={(module.config as { altText?: string }).altText || ""}
                  className="h-8 w-8 rounded object-cover flex-shrink-0"
                />
              )}
              <p className="text-sm text-gray-900 truncate">
                {(module.config as { altText?: string }).altText ||
                  "(No image selected)"}
              </p>
            </div>
          )}
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
  const { showToast } = useToast();
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
  const [textContent, setTextContent] = useState<JSONContent>({
    type: "doc",
    content: [],
  });
  const [imagePickerStep, setImagePickerStep] = useState<
    "picker" | "config" | null
  >(null);
  const [imageModuleConfig, setImageModuleConfig] = useState({
    imageId: "",
    url: "",
    altText: "",
    caption: "",
    fullWidth: false,
  });
  const [messagingPrompt, setMessagingPrompt] = useState("");

  // Per-instance style overrides for the messaging module
  const [messagingInputBg, setMessagingInputBg] = useState(
    DEFAULT_INPUT_BACKGROUND,
  );
  const [messagingInputText, setMessagingInputText] =
    useState(DEFAULT_INPUT_TEXT);
  const [messagingButtonBg, setMessagingButtonBg] = useState(
    DEFAULT_BUTTON_BACKGROUND,
  );
  const [messagingButtonText, setMessagingButtonText] =
    useState(DEFAULT_BUTTON_TEXT);
  const [activeMessagingPicker, setActiveMessagingPicker] = useState<
    "inputBg" | "inputText" | "buttonBg" | "buttonText" | null
  >(null);

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
        config:
          moduleType === "image"
            ? {
                imageId: "",
                url: "",
                altText: "",
                caption: "",
                fullWidth: false,
              }
            : moduleType === "messaging"
              ? { moduleType: "messaging", prompt: "", isOpen: true }
              : { content: { type: "doc", content: [] } },
      };
      setEditingModule(newModule);
      if (moduleType === "text") {
        setTextContent({ type: "doc", content: [] });
      } else if (moduleType === "messaging") {
        setMessagingPrompt("");
        setMessagingInputBg(DEFAULT_INPUT_BACKGROUND);
        setMessagingInputText(DEFAULT_INPUT_TEXT);
        setMessagingButtonBg(DEFAULT_BUTTON_BACKGROUND);
        setMessagingButtonText(DEFAULT_BUTTON_TEXT);
      } else {
        setImageModuleConfig({
          imageId: "",
          url: "",
          altText: "",
          caption: "",
          fullWidth: false,
        });
        setImagePickerStep("picker");
      }
    },
    [modules.length],
  );

  const handleEditModule = useCallback((module: ModuleInstance) => {
    setEditingModule(module);
    if (module.moduleType === "text") {
      const content = (module.config as { content?: JSONContent }).content;
      setTextContent(content || { type: "doc", content: [] });
    } else if (module.moduleType === "messaging") {
      const cfg = module.config as unknown as MessagingModuleConfig;
      setMessagingPrompt(cfg.prompt ?? "");
      setMessagingInputBg(
        cfg.styleOverrides?.inputBackgroundColor ?? DEFAULT_INPUT_BACKGROUND,
      );
      setMessagingInputText(
        cfg.styleOverrides?.inputTextColor ?? DEFAULT_INPUT_TEXT,
      );
      setMessagingButtonBg(
        cfg.styleOverrides?.buttonBackgroundColor ?? DEFAULT_BUTTON_BACKGROUND,
      );
      setMessagingButtonText(
        cfg.styleOverrides?.buttonTextColor ?? DEFAULT_BUTTON_TEXT,
      );
    } else {
      const cfg = module.config as {
        imageId?: string;
        url?: string;
        altText?: string;
        caption?: string;
        fullWidth?: boolean;
      };
      setImageModuleConfig({
        imageId: cfg.imageId ?? "",
        url: cfg.url ?? "",
        altText: cfg.altText ?? "",
        caption: cfg.caption ?? "",
        fullWidth: cfg.fullWidth ?? false,
      });
      setImagePickerStep("config");
    }
  }, []);

  const handleSaveModule = useCallback(() => {
    if (!editingModule) return;

    const updatedModule: ModuleInstance =
      editingModule.moduleType === "text"
        ? { ...editingModule, config: { content: textContent } }
        : editingModule.moduleType === "messaging"
          ? (() => {
              const hasOverrides =
                messagingInputBg !== DEFAULT_INPUT_BACKGROUND ||
                messagingInputText !== DEFAULT_INPUT_TEXT ||
                messagingButtonBg !== DEFAULT_BUTTON_BACKGROUND ||
                messagingButtonText !== DEFAULT_BUTTON_TEXT;
              return {
                ...editingModule,
                config: {
                  moduleType: "messaging",
                  prompt: messagingPrompt,
                  isOpen: true,
                  ...(hasOverrides && {
                    styleOverrides: {
                      inputBackgroundColor: messagingInputBg,
                      inputTextColor: messagingInputText,
                      buttonBackgroundColor: messagingButtonBg,
                      buttonTextColor: messagingButtonText,
                    },
                  }),
                },
              };
            })()
          : { ...editingModule, config: { ...imageModuleConfig } };

    setModules((prev) => {
      const existing = prev.find((m) => m.id === editingModule.id);
      if (existing) {
        return prev.map((m) => (m.id === editingModule.id ? updatedModule : m));
      } else {
        return [...prev, updatedModule];
      }
    });

    setEditingModule(null);
    setTextContent({ type: "doc", content: [] });
    setImagePickerStep(null);
    setImageModuleConfig({
      imageId: "",
      url: "",
      altText: "",
      caption: "",
      fullWidth: false,
    });
  }, [
    editingModule,
    textContent,
    imageModuleConfig,
    messagingPrompt,
    messagingInputBg,
    messagingInputText,
    messagingButtonBg,
    messagingButtonText,
  ]);

  const handleDeleteModule = useCallback((moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  }, []);

  const handleCancelEditModule = useCallback(() => {
    setEditingModule(null);
    setTextContent({ type: "doc", content: [] });
    setImagePickerStep(null);
    setImageModuleConfig({
      imageId: "",
      url: "",
      altText: "",
      caption: "",
      fullWidth: false,
    });
    setMessagingPrompt("");
    setMessagingInputBg(DEFAULT_INPUT_BACKGROUND);
    setMessagingInputText(DEFAULT_INPUT_TEXT);
    setMessagingButtonBg(DEFAULT_BUTTON_BACKGROUND);
    setMessagingButtonText(DEFAULT_BUTTON_TEXT);
    setActiveMessagingPicker(null);
  }, []);

  const handleImagePickerSelect = useCallback((image: ImagePickerSelection) => {
    setImageModuleConfig((prev) => ({
      ...prev,
      imageId: image.id,
      url: image.url,
      // Pre-fill alt text from the image name only if it hasn't been set yet
      altText: prev.altText || image.name,
    }));
    setImagePickerStep("config");
  }, []);

  const handleImagePickerClose = useCallback(() => {
    if (imageModuleConfig.url) {
      // Already have an image selected — go back to the config form
      setImagePickerStep("config");
    } else {
      // No image yet (new module) — discard the whole thing
      setEditingModule(null);
      setImagePickerStep(null);
    }
  }, [imageModuleConfig.url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Please enter a scene name", { variant: "warning" });
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
      showToast("Failed to save scene", { variant: "error" });
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

      {/* Image picker — shown as a standalone overlay when selecting an image */}
      {editingModule?.moduleType === "image" &&
        imagePickerStep === "picker" && (
          <ImagePickerDialog
            organizationId={organizationId}
            onSelect={handleImagePickerSelect}
            onClose={handleImagePickerClose}
          />
        )}

      {/* Module editor modal */}
      {editingModule &&
        (editingModule.moduleType !== "image" ||
          imagePickerStep === "config") && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingModule.moduleType === "text"
                  ? "Edit Text Module"
                  : editingModule.moduleType === "messaging"
                    ? "Edit Messaging Module"
                    : "Edit Image Module"}
              </h3>

              <div className="mb-6">
                {editingModule.moduleType === "text" ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content
                    </label>
                    <RichTextEditor
                      content={textContent}
                      onChange={setTextContent}
                      placeholder="Start typing your content here..."
                    />
                  </>
                ) : editingModule.moduleType === "messaging" ? (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="messaging-prompt"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Prompt <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="messaging-prompt"
                        value={messagingPrompt}
                        onChange={(e) => setMessagingPrompt(e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
                        placeholder="e.g. Got a question for our guest?"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Shown above the message input on audience devices.
                      </p>
                    </div>

                    {/* Style overrides */}
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Colour overrides{" "}
                        <span className="font-normal text-gray-400">
                          (optional — leave as defaults to use brand colours)
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {(
                          [
                            {
                              label: "Input Background",
                              value: messagingInputBg,
                              setter: setMessagingInputBg,
                              pickerKey: "inputBg" as const,
                            },
                            {
                              label: "Input Text",
                              value: messagingInputText,
                              setter: setMessagingInputText,
                              pickerKey: "inputText" as const,
                            },
                            {
                              label: "Button Background",
                              value: messagingButtonBg,
                              setter: setMessagingButtonBg,
                              pickerKey: "buttonBg" as const,
                            },
                            {
                              label: "Button Text",
                              value: messagingButtonText,
                              setter: setMessagingButtonText,
                              pickerKey: "buttonText" as const,
                            },
                          ] as const
                        ).map(({ label, value, setter, pickerKey }) => (
                          <div key={pickerKey}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {label}
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMessagingPicker(pickerKey)
                                }
                                className="flex-shrink-0 w-7 h-7 rounded border-2 border-gray-300 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                                style={{ backgroundColor: value }}
                                title="Click to open colour picker"
                              />
                              <input
                                type="text"
                                value={value}
                                onChange={(e) =>
                                  setter(e.target.value.toUpperCase())
                                }
                                className="block w-full border-gray-300 rounded text-xs px-2 py-1.5 font-mono"
                                maxLength={7}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image preview */}
                    {imageModuleConfig.url && (
                      <div className="relative rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={imageModuleConfig.url}
                          alt={imageModuleConfig.altText}
                          className="w-full max-h-48 object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setImagePickerStep("picker")}
                          className="absolute bottom-2 right-2 px-3 py-1.5 text-xs font-medium text-white bg-black/60 hover:bg-black/80 rounded-md transition-colors"
                        >
                          Change image
                        </button>
                      </div>
                    )}

                    {/* Alt text */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alt text <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={imageModuleConfig.altText}
                        onChange={(e) =>
                          setImageModuleConfig((prev) => ({
                            ...prev,
                            altText: e.target.value,
                          }))
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
                        placeholder="Describe the image for screen readers"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Used by screen readers and shown if the image fails to
                        load.
                      </p>
                    </div>

                    {/* Caption */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Caption{" "}
                        <span className="text-gray-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={imageModuleConfig.caption}
                        onChange={(e) =>
                          setImageModuleConfig((prev) => ({
                            ...prev,
                            caption: e.target.value,
                          }))
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
                        placeholder="Add a caption below the image…"
                      />
                    </div>

                    {/* Full-width toggle */}
                    <div className="flex items-start gap-3 pt-1">
                      <input
                        type="checkbox"
                        id="image-full-width"
                        checked={imageModuleConfig.fullWidth}
                        onChange={(e) =>
                          setImageModuleConfig((prev) => ({
                            ...prev,
                            fullWidth: e.target.checked,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <label
                          htmlFor="image-full-width"
                          className="block text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Full width (no padding)
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          By default the image uses the same side padding as
                          text content. Tick this to extend it to the screen
                          edges.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelEditModule}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModule}
                  disabled={
                    (editingModule.moduleType === "image" &&
                      (!imageModuleConfig.url ||
                        !imageModuleConfig.altText.trim())) ||
                    (editingModule.moduleType === "messaging" &&
                      !messagingPrompt.trim())
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Module
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Messaging module colour picker popover */}
      {activeMessagingPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setActiveMessagingPicker(null)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-2xl p-4 border border-gray-200 max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                {activeMessagingPicker === "inputBg"
                  ? "Input Background Colour"
                  : activeMessagingPicker === "inputText"
                    ? "Input Text Colour"
                    : activeMessagingPicker === "buttonBg"
                      ? "Button Background Colour"
                      : "Button Text Colour"}
              </h3>
              <button
                onClick={() => setActiveMessagingPicker(null)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex justify-center mb-3">
              <HexColorPicker
                color={
                  activeMessagingPicker === "inputBg"
                    ? messagingInputBg
                    : activeMessagingPicker === "inputText"
                      ? messagingInputText
                      : activeMessagingPicker === "buttonBg"
                        ? messagingButtonBg
                        : messagingButtonText
                }
                onChange={
                  activeMessagingPicker === "inputBg"
                    ? setMessagingInputBg
                    : activeMessagingPicker === "inputText"
                      ? setMessagingInputText
                      : activeMessagingPicker === "buttonBg"
                        ? setMessagingButtonBg
                        : setMessagingButtonText
                }
                style={{ width: "220px", height: "160px" }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-700 mb-1">
                Selected Colour
              </p>
              <p className="text-sm font-mono text-gray-900">
                {activeMessagingPicker === "inputBg"
                  ? messagingInputBg
                  : activeMessagingPicker === "inputText"
                    ? messagingInputText
                    : activeMessagingPicker === "buttonBg"
                      ? messagingButtonBg
                      : messagingButtonText}
              </p>
            </div>
          </div>
        </>
      )}
    </form>
  );
}
