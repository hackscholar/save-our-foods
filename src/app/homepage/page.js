"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import { ITEM_CATEGORIES, getCategoryLabel } from "@/lib/item-categories";
import IngredientPopup from "../components/ingedientspopup";
import "./homepage.css";

const CHATBOT_IMAGES = {
  idle: "/chatbot-idle.png",
  hover: "/chatbot-hover.png",
  speaking: "/chatbot-speaking.png",
};

const CHATBOT_SPEAK_DELAY = 1500;
const INITIAL_CHATBOT_RECIPE = { loading: false, data: null, error: null };
const DEFAULT_ITEM_CATEGORY = ITEM_CATEGORIES[0]?.value ?? "";
const CATEGORY_SHORTCUTS = [
  { label: "All", value: null },
  ...ITEM_CATEGORIES.map(({ value, label }) => ({
    label,
    value,
  })),
];

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const SORTERS = {
  expiry: (a, b) => {
    const dateA = a?.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const dateB = b?.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    return dateA - dateB;
  },
  expiryLatest: (a, b) => {
    const dateA = a?.expiryDate ? new Date(a.expiryDate).getTime() : -Infinity;
    const dateB = b?.expiryDate ? new Date(b.expiryDate).getTime() : -Infinity;
    return dateB - dateA;
  },
  quantity: (a, b) => {
    const qtyA = a?.quantity ?? Infinity;
    const qtyB = b?.quantity ?? Infinity;
    return qtyA - qtyB;
  },
  quantityHigh: (a, b) => {
    const qtyA = a?.quantity ?? -Infinity;
    const qtyB = b?.quantity ?? -Infinity;
    return qtyB - qtyA;
  },
  priceLow: (a, b) => {
    const priceA =
      a?.price !== null && a?.price !== undefined
        ? Number(a.price)
        : Infinity;
    const priceB =
      b?.price !== null && b?.price !== undefined
        ? Number(b.price)
        : Infinity;
    return priceA - priceB;
  },
  priceHigh: (a, b) => {
    const priceA =
      a?.price !== null && a?.price !== undefined
        ? Number(a.price)
        : -Infinity;
    const priceB =
      b?.price !== null && b?.price !== undefined
        ? Number(b.price)
        : -Infinity;
    return priceB - priceA;
  },
};

function createEmptyForm() {
  return {
    name: "",
    quantity: "",
    expiryDate: "",
    dateOfPurchase: toDateInput(new Date()),
    imagePath: "",
    category: "",
    category: DEFAULT_ITEM_CATEGORY,
  };
}

function sortItems(items = [], sortKey = "expiry") {
  const sorter = SORTERS[sortKey] ?? SORTERS.expiry;
  return [...items].sort(sorter);
}

function applyFilters(items = [], filters, categoryFilter = null) {
  const normalizedCategory = categoryFilter ?? null;
  const categoryFiltered =
    normalizedCategory === null
      ? items
      : items.filter((item) => {
          const itemCategory = item.category ?? null;
          if (normalizedCategory === "other") {
            return !itemCategory || itemCategory === "other";
          }
          return itemCategory === normalizedCategory;
        });

  const query = filters.search.trim().toLowerCase();
  const filtered = query
    ? categoryFiltered.filter((item) =>
        (item.name ?? "").toLowerCase().includes(query),
      )
    : categoryFiltered;
  return sortItems(filtered, filters.sort);
}

function filterByCategory(items = [], category) {
  if (!category) {
    return items;
  }
  return items.filter((item) => item.category === category);
}

function formatNotification(record) {
  if (!record) return null;
  return {
    id: record.id,
    type: record.type,
    payload: record.payload ?? {},
    read: Boolean(record.read),
    createdAt: record.createdAt ?? record.created_at ?? null,
    readAt: record.readAt ?? record.read_at ?? null,
  };
}

function describeNotification(notification) {
  const payload = notification?.payload ?? {};
  switch (notification?.type) {
    case "purchase_request":
      return `${payload.buyerName ?? "A buyer"} wants ${
        payload.itemName ?? "one of your items"
      }.`;
    case "expiry_alert":
      if (payload.itemName && payload.expiresInHours !== undefined) {
        return `${payload.itemName} expires in ${
          payload.expiresInHours
        }h. Check it now.`;
      }
      return `An item is nearing expiry.`;
    default:
      return "You have a new notification.";
  }
}

export default function Homepage() {
  const router = useRouter();
  const profileMenuRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const chatbotTimerRef = useRef(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [activeTab, setActiveTab] = useState("my-groceries");
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsState, setItemsState] = useState({ loading: false, error: null });
  const [marketItems, setMarketItems] = useState([]);
  const [marketState, setMarketState] = useState({ loading: false, error: null });
  const [isModalOpen, setModalOpen] = useState(false);
  const [newItem, setNewItem] = useState(createEmptyForm());
  const [editingItem, setEditingItem] = useState(null);
  const [createState, setCreateState] = useState({ loading: false, error: null });
  const [deleteState, setDeleteState] = useState({ loading: false, error: null });
  const [unlistState, setUnlistState] = useState({ loadingId: null, error: null });
  const [uploadState, setUploadState] = useState({
    uploading: false,
    error: null,
  });
  const [enrichState, setEnrichState] = useState({ loading: false, error: null });
  const [sellDialog, setSellDialog] = useState({
    open: false,
    loading: false,
    error: null,
    suggestion: null,
    item: null,
    priceInput: "",
  });
  const [inventoryFilters, setInventoryFilters] = useState({
    search: "",
    sort: "expiry",
  });
  const [marketFilters, setMarketFilters] = useState({
    search: "",
    sort: "expiry",
  });
  const [cartItems, setCartItems] = useState([]);
  const [cartSelections, setCartSelections] = useState({});
  const [cartState, setCartState] = useState({ loading: false, error: null, success: null });
  const [notifications, setNotifications] = useState([]);
  const [notificationsState, setNotificationsState] = useState({
    loading: false,
    error: null,
  });
  const [notificationToast, setNotificationToast] = useState(null);
  const [chatbotState, setChatbotState] = useState("idle");
  const [isIngredientPopupOpen, setIngredientPopupOpen] = useState(false);
  const [chatbotRecipe, setChatbotRecipe] = useState(INITIAL_CHATBOT_RECIPE);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const categoryShortcuts = CATEGORY_SHORTCUTS;

  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;
    function handleClickOutside(event) {
      if (!notificationsMenuRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("smf_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to read saved user", error);
    }
  }, []);

  const fetchInventoryItems = useCallback(async () => {
    if (!user?.id) return;
    setItemsState({ loading: true, error: null });
    try {
      const response = await fetch(`/api/items?sellerId=${user.id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load items.");
      }
      setItems(data.items ?? []);
      setItemsState({ loading: false, error: null });
    } catch (error) {
      setItemsState({ loading: false, error: error.message });
    }
  }, [user?.id]);

  const fetchMarketplaceItems = useCallback(async () => {
    setMarketState({ loading: true, error: null });
    try {
      const response = await fetch("/api/items?type=marketplace");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load marketplace items.");
      }
      setMarketItems(data.items ?? []);
      setMarketState({ loading: false, error: null });
    } catch (error) {
      setMarketState({ loading: false, error: error.message });
    }
  }, []);

  const refreshItems = useCallback(() => {
    if (user?.id) {
      fetchInventoryItems();
    }
    fetchMarketplaceItems();
  }, [user?.id, fetchInventoryItems, fetchMarketplaceItems]);

  const handleChatbotInteractionStart = useCallback(() => {
    if (chatbotTimerRef.current) {
      clearTimeout(chatbotTimerRef.current);
      chatbotTimerRef.current = null;
    }

    setChatbotState((previous) => {
      if (previous === "speaking") {
        return previous;
      }
      chatbotTimerRef.current = setTimeout(() => {
        setChatbotState("speaking");
        chatbotTimerRef.current = null;
      }, CHATBOT_SPEAK_DELAY);
      return "hover";
    });
  }, []);

  const handleChatbotInteractionEnd = useCallback(() => {
    if (chatbotTimerRef.current) {
      clearTimeout(chatbotTimerRef.current);
      chatbotTimerRef.current = null;
    }
    setChatbotState("idle");
  }, []);

  async function fetchNotificationsList(limit = 50) {
    if (!user?.id) return;
    setNotificationsState({ loading: true, error: null });
    try {
      const response = await fetch(
        `/api/notifications?userId=${user.id}&limit=${limit}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load notifications.");
      }
      const next = Array.isArray(data.notifications)
        ? data.notifications.map(formatNotification).filter(Boolean)
        : [];
      setNotifications(next);
      setNotificationsState({ loading: false, error: null });
    } catch (error) {
      setNotificationsState({ loading: false, error: error.message });
    }
  }

  function handleNotificationsToggle() {
    if (!user) return;
    setNotificationsOpen((prev) => !prev);
    if (!notifications.length && !notificationsState.loading) {
      fetchNotificationsList();
    }
  }

  async function handleNotificationRead(notificationId) {
    if (!notificationId) return;
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              read: true,
              readAt: notification.readAt ?? new Date().toISOString(),
            }
          : notification,
      ),
    );
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  }

  async function handleMarkAllNotificationsRead() {
    if (!user?.id) return;
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (error) {
      console.error("Failed to mark all notifications read", error);
    }
  }

  const handleChatbotYes = useCallback(() => {
    handleChatbotInteractionEnd();
    setIngredientPopupOpen(true);
  }, [handleChatbotInteractionEnd]);

  const handleChatbotNo = useCallback(() => {
    handleChatbotInteractionEnd();
  }, [handleChatbotInteractionEnd]);

  const handleIngredientPopupClose = useCallback(() => {
    setIngredientPopupOpen(false);
  }, []);

  const handleChatbotFocusOut = useCallback(
    (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        handleChatbotInteractionEnd();
      }
    },
    [handleChatbotInteractionEnd],
  );

  const handleIngredientConfirm = useCallback(
    async (entries = []) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update your groceries.");
      }

      const inventoryById = items.reduce((acc, item) => {
        if (item.type !== "marketplace") {
          acc[item.id] = item;
        }
        return acc;
      }, {});

      const actionable = entries
        .map((entry) => ({
          itemId: entry.itemId,
          quantity: Number(entry.quantity),
        }))
        .filter(
          (entry) =>
            entry.itemId && entry.quantity !== null && !Number.isNaN(entry.quantity) && entry.quantity > 0,
        );

      if (actionable.length === 0) {
        setIngredientPopupOpen(false);
        return;
      }

      for (const entry of actionable) {
        const currentItem = inventoryById[entry.itemId];
        if (!currentItem) continue;
        const currentQuantity = Number(currentItem.quantity ?? 0);
        if (Number.isNaN(currentQuantity) || currentQuantity <= 0) continue;

        const decrement = Math.min(currentQuantity, Math.max(0, Math.round(entry.quantity)));
        if (decrement <= 0) continue;
        const nextQuantity = Math.max(0, currentQuantity - decrement);

        const response = await fetch("/api/items", {
          method: nextQuantity > 0 ? "PATCH" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body:
            nextQuantity > 0
              ? JSON.stringify({ id: currentItem.id, quantity: nextQuantity })
              : JSON.stringify({ id: currentItem.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to update your groceries.");
        }
      }

      refreshItems();
      setIngredientPopupOpen(false);
    },
    [items, refreshItems, user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    fetchInventoryItems();
  }, [user?.id, fetchInventoryItems]);

  useEffect(() => {
    fetchMarketplaceItems();
  }, [fetchMarketplaceItems]);

  useEffect(() => {
    setCartItems((prev) => {
      let changed = false;
      const next = prev
        .map((item) => {
          const latest = marketItems.find((marketItem) => marketItem.id === item.id);
          if (!latest) {
            changed = true;
            return null;
          }
          const available = Number(latest.quantity ?? 0);
          if (!Number.isFinite(available) || available <= 0) {
            changed = true;
            return null;
          }
          const max = Math.max(1, Math.floor(available));
          const clampedQuantity = clampQuantity(item.quantity, max);
          if (clampedQuantity !== item.quantity || max !== item.availableQuantity) {
            changed = true;
          }
          return {
            ...item,
            quantity: clampedQuantity,
            availableQuantity: max,
          };
        })
        .filter(Boolean);
      return changed ? next : prev;
    });
  }, [marketItems]);

  useEffect(() => {
    setCartSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(prev).forEach(([itemId, value]) => {
        const latest = marketItems.find((item) => item.id === itemId);
        if (!latest) {
          return;
        }
        const max = Math.max(1, Number(latest.quantity ?? 1));
        const clamped = clampQuantity(value, max);
        if (clamped !== value) {
          next[itemId] = clamped;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [marketItems]);

  useEffect(() => {
    return () => {
      if (chatbotTimerRef.current) {
        clearTimeout(chatbotTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    fetchNotificationsList();
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setNotificationsOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:user:${user.id}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "notifications",
          event: "INSERT",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const formatted = formatNotification(payload.new);
          if (!formatted) return;
          setNotifications((prev) => {
            const existing = prev.filter(
              (notification) => notification.id !== formatted.id,
            );
            return [formatted, ...existing];
          });
          setNotificationToast({
            id: formatted.id,
            message: describeNotification(formatted),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!notificationToast) return undefined;
    const timer = setTimeout(() => setNotificationToast(null), 5000);
    return () => clearTimeout(timer);
  }, [notificationToast]);

  function openNewItemModal() {
    setNewItem(createEmptyForm());
    setEditingItem(null);
    setUploadState({ uploading: false, error: null });
    setEnrichState({ loading: false, error: null });
    setCreateState({ loading: false, error: null });
    setDeleteState({ loading: false, error: null });
    setModalOpen(true);
  }

  function handleNewItemChange(event) {
    const { name, value } = event.target;
    setNewItem((prev) => ({ ...prev, [name]: value }));
  }

  function handleProfileToggle() {
    setProfileMenuOpen((prev) => !prev);
  }

  function handleEditInfo() {
    setProfileMenuOpen(false);
    router.push("/account");
  }

  function handleSignOut() {
    setProfileMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("smf_user");
      window.localStorage.removeItem("smf_session");
    }
    setUser(null);
    router.push("/");
  }

  async function handleSaveItem(event) {
    event.preventDefault();
    if (!user?.id) return;
    setCreateState({ loading: true, error: null });
    try {
      const basePayload = {
        name: newItem.name,
        quantity: newItem.quantity ? Number(newItem.quantity) : 0,
        expiryDate: newItem.expiryDate || null,
        dateOfPurchase: newItem.dateOfPurchase || null,
        imagePath: newItem.imagePath || null,
        category: newItem.category || null,
        category: newItem.category || DEFAULT_ITEM_CATEGORY || null,
      };

      const requestInit =
        editingItem && editingItem.id
          ? {
              method: "PATCH",
              body: JSON.stringify({ ...basePayload, id: editingItem.id }),
            }
          : {
              method: "POST",
              body: JSON.stringify({
                ...basePayload,
                sellerId: user.id,
                price: null,
                type: "inventory",
              }),
            };

      const response = await fetch("/api/items", {
        ...requestInit,
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        const detail =
          data?.details && typeof data.details === "object"
            ? Object.values(data.details).join(" ")
            : null;
        throw new Error(detail ?? data?.error ?? "Unable to save item.");
      }
      setCreateState({ loading: false, error: null });
      setNewItem(createEmptyForm());
      setEditingItem(null);
      setModalOpen(false);
      refreshItems();
    } catch (error) {
      setCreateState({ loading: false, error: error.message });
    }
  }

  async function handleDeleteItem() {
    if (!editingItem?.id) return;
    setDeleteState({ loading: true, error: null });
    try {
      const response = await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingItem.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to delete item.");
      }
      setDeleteState({ loading: false, error: null });
      setModalOpen(false);
      setEditingItem(null);
      refreshItems();
    } catch (error) {
      setDeleteState({ loading: false, error: error.message });
    }
  }

  async function handleUnlistItem(item) {
    if (!item?.id) return;
    setUnlistState({ loadingId: item.id, error: null });
    try {
      const response = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: "inventory", price: null }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to unlist item.");
      }
      setUnlistState({ loadingId: null, error: null });
      refreshItems();
    } catch (error) {
      setUnlistState({ loadingId: null, error: error.message });
    }
  }
  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      setUploadState({ uploading: false, error: "You must be logged in to upload images." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sellerId", user.id);

    setUploadState({ uploading: true, error: null });
    setEnrichState({ loading: false, error: null });

    try {
      const uploadResponse = await fetch("/api/uploads/product-image", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error ?? "Failed to upload image.");
      }
      const publicUrl = uploadData.publicUrl ?? uploadData.path;
      setNewItem((prev) => ({ ...prev, imagePath: publicUrl }));
      setUploadState({ uploading: false, error: null });

      setEnrichState({ loading: true, error: null });
      const enrichResponse = await fetch("/api/items/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: publicUrl,
          sellerId: user.id,
          dateOfPurchase: newItem.dateOfPurchase,
        }),
      });
      const enrichData = await enrichResponse.json();
      if (!enrichResponse.ok) {
        throw new Error(enrichData?.error ?? "Unable to analyze item.");
      }
      const aiName = enrichData.item?.name ?? enrichData.ai?.name ?? null;
      const aiExpiry = enrichData.item?.expiryDate ?? enrichData.ai?.expiryDate ?? null;
      const aiCategory = enrichData.item?.category ?? enrichData.ai?.category ?? null;
      const inferredQuantity = enrichData.ai?.quantity ?? null;
      const parsedQuantity =
        inferredQuantity !== null && inferredQuantity !== undefined
          ? Number(inferredQuantity)
          : null;
      setNewItem((prev) => ({
        ...prev,
        name: aiName ?? prev.name,
        expiryDate: aiExpiry ? aiExpiry.slice(0, 10) : prev.expiryDate,
        quantity:
          parsedQuantity !== null && !Number.isNaN(parsedQuantity) && parsedQuantity > 0
            ? String(parsedQuantity)
            : prev.quantity,
        category: aiCategory ?? prev.category,
      }));
      setEnrichState({ loading: false, error: null });
    } catch (error) {
      setUploadState({ uploading: false, error: error.message });
      setEnrichState({ loading: false, error: error.message });
    }
  }

  function handleEditItem(item) {
    setEditingItem(item);
    setNewItem({
      name: item.name ?? "",
      quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : "",
      expiryDate: toDateInput(item.expiryDate),
      dateOfPurchase: toDateInput(item.dateOfPurchase) || toDateInput(new Date()),
      imagePath: item.imagePath ?? "",
      category: item.category ?? "",
      category: item.category ?? DEFAULT_ITEM_CATEGORY,
    });
    setUploadState({ uploading: false, error: null });
    setEnrichState({ loading: false, error: null });
    setCreateState({ loading: false, error: null });
    setModalOpen(true);
  }

  async function handleSellItem(item) {
    if (!item?.id) return;
    setSellDialog({
      open: true,
      loading: true,
      error: null,
      suggestion: null,
      item,
      priceInput: "",
    });
    try {
      const response = await fetch("/api/items/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity,
          expiryDate: item.expiryDate,
          dateOfPurchase: item.dateOfPurchase,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to estimate price.");
      }
      setSellDialog({
        open: true,
        loading: false,
        error: null,
        suggestion: data.suggestion,
        item,
        priceInput:
          data.suggestion?.price !== undefined && data.suggestion?.price !== null
            ? String(data.suggestion.price)
            : "",
      });
    } catch (error) {
      setSellDialog({
        open: true,
        loading: false,
        error: error.message,
        suggestion: null,
        item,
        priceInput: "",
      });
    }
  }

  async function confirmSell() {
    if (!sellDialog.item?.id || !sellDialog.priceInput) return;
    setSellDialog((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sellDialog.item.id,
          type: "marketplace",
          price: Number(sellDialog.priceInput),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to list item.");
      }
      setSellDialog({
        open: false,
        loading: false,
        error: null,
        suggestion: null,
        item: null,
        priceInput: "",
      });
      refreshItems();
    } catch (error) {
      setSellDialog((prev) => ({ ...prev, loading: false, error: error.message }));
    }
  }

  const inventoryItems = applyFilters(
    items.filter((item) => item.type !== "marketplace"),
    inventoryFilters,
    selectedCategory,
  );
  const marketplaceItems = applyFilters(marketItems, marketFilters, selectedCategory);
  const filteredInventoryItems = filterByCategory(inventoryItems, selectedCategory);
  const filteredMarketplaceItems = filterByCategory(marketplaceItems, selectedCategory);
  const unreadNotifications = notifications.filter(
    (notification) => !notification.read,
  ).length;
  function addToCart(item) {
    if (!item || item.sellerId === user?.id) return;
    const available = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
    const desired = clampQuantity(cartSelections[item.id] ?? 1, available);
    setCartItems((prev) => {
      if (prev.some((entry) => entry.id === item.id)) return prev;
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          sellerId: item.sellerId,
          quantity: desired,
          availableQuantity: available,
          category: item.category ?? null,
        },
      ];
    });
    setCartSelections((prev) => ({
      ...prev,
      [item.id]: desired,
    }));
    setCartState({ loading: false, error: null, success: null });
  }

  function removeFromCart(id) {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function notifySellersFromCart(itemsToNotify) {
    if (!user?.id || !Array.isArray(itemsToNotify) || itemsToNotify.length === 0) {
      return;
    }
    await Promise.allSettled(
      itemsToNotify.map((item) => {
        if (!item?.id) return Promise.resolve();
        return fetch("/api/items/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: item.id,
            buyerId: user.id,
            quantity: item.quantity ?? 1,
          }),
        }).catch((error) => {
          console.error("Failed to notify seller for item", item.id, error);
        });
      }),
    );
  }

  async function checkoutCart() {
    if (cartItems.length === 0 || !user?.email) {
      setCartState({ loading: false, error: "Cart is empty or missing buyer email.", success: null });
      return;
    }
    const itemsSnapshot = [...cartItems];
    setCartState({ loading: true, error: null, success: null });
    try {
      const response = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: user.id,
          buyerEmail: user.email,
          buyerName: user.name,
          items: cartItems.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price ?? 0,
            quantity: 1,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to checkout.");
      }
      await notifySellersFromCart(itemsSnapshot);
      setCartItems([]);
      if (data.pdf) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${data.pdf}`;
        link.download = data.fileName ?? `saveourfoods-receipt-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setCartState({ loading: false, error: null, success: "Receipt downloaded." });
    } catch (error) {
      setCartState({ loading: false, error: error.message, success: null });
    }
  }
  
  const canManageItem = (item) => item?.sellerId === user?.id;
  const isInCart = (id) => cartItems.some((item) => item.id === id);

  function clampQuantity(value, max = Infinity) {
    const parsed = Math.floor(Number(value));
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 1;
    }
    if (!Number.isFinite(max) || max <= 0) {
      return parsed;
    }
    return Math.max(1, Math.min(parsed, Math.floor(max)));
  }

  function getAvailableQuantity(itemId) {
    const latest = marketItems.find((item) => item.id === itemId);
    if (!latest) {
      return null;
    }
    return Number(latest.quantity ?? null);
  }

  function handleSelectionChange(itemId, value, max = Infinity) {
    setCartSelections((prev) => ({
      ...prev,
      [itemId]: clampQuantity(value, max),
    }));
  }

  function handleCartQuantityChange(itemId, value) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const max = getAvailableQuantity(itemId) ?? item.availableQuantity ?? Infinity;
        return {
          ...item,
          quantity: clampQuantity(value, max),
        };
      }),
    );
  }
  const chatbotImageSrc = CHATBOT_IMAGES[chatbotState] ?? CHATBOT_IMAGES.idle;
  function handleCategorySelect(value) {
    setSelectedCategory((prev) => (prev === value ? null : value));
  }

  return (
    <main className="homepage-root">
            {/* INTRO OVERLAY (transparent green → fade out) */}
            <div
                className={`intro-overlay ${hasEntered ? "intro-overlay--fade-out" : ""
                    }`}
            >
                <div className="intro-content">
                    <h1 className="intro-title hover-grow">SaveOurFoods</h1>

                    <p className="intro-subtitle">
                        <span className="typewriter hover-grow">
                            Your grocery-sharing marketplace.
                        </span>
                    </p>

                    {/* You can keep or delete this hint text; it no longer controls anything */}
                    <p className="intro-hint hover-grow-small">
                        Welcome in!
                    </p>
                </div>
            </div>

            {/* REAL HOMEPAGE */}
            <div className="homepage-shell">
                {notificationToast && (
                    <div className="notification-toast" role="status">
                        <span>{notificationToast.message}</span>
                        <button
                            type="button"
                            className="notification-toast__dismiss"
                            aria-label="Dismiss notification"
                            onClick={() => setNotificationToast(null)}
                        >
                            X
                        </button>
                    </div>
                )}
                {/* Header */}
                <header className="homepage-header">
                    <div className="header-left">
                        <Image
                            src="/icon.png"
                            alt="SaveOurFoods logo"
                            width={50}
                            height={50}
                            className="header-logo"
                        />
                        <span className="header-title">SaveOurFoods</span>
                    </div>
                    <div className="header-right">
                        <div className="notification-center" ref={notificationsMenuRef}>
                            <button
                                type="button"
                                className={`notification-button ${unreadNotifications > 0 ? "notification-button--active" : ""}`}
                                onClick={handleNotificationsToggle}
                                aria-expanded={isNotificationsOpen}
                                aria-label="Open notifications"
                                disabled={!user}
                            >
                                <span className="notification-button__icon" aria-hidden="true">
                                    {"\u{1F514}"}
                                </span>
                                <span className="notification-button__label">Alerts</span>
                                <span className="notification-button__total">
                                    {notifications.length > 99 ? "99+" : notifications.length}
                                </span>
                                {unreadNotifications > 0 && (
                                    <span className="notification-badge">
                                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                                    </span>
                                )}
                            </button>
                            {isNotificationsOpen && (
                                <div className="notification-panel">
                                    <div className="notification-panel__header">
                                        <div>
                                            <p className="notification-panel__title">Alerts</p>
                                            <p className="notification-panel__subtitle">
                                                Stay in sync with buyers and expiring stock.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="notification-panel__mark-all"
                                            onClick={handleMarkAllNotificationsRead}
                                            disabled={unreadNotifications === 0}
                                        >
                                            Mark all read
                                        </button>
                                    </div>
                                    {notificationsState.error && (
                                        <p className="notification-error">{notificationsState.error}</p>
                                    )}
                                    <div className="notification-panel__body">
                                        {notificationsState.loading ? (
                                            <p className="notification-empty">Loading alerts...</p>
                                        ) : notifications.length === 0 ? (
                                            <p className="notification-empty">
                                                You&apos;re all caught up.
                                            </p>
                                        ) : (
                                            <ul className="notification-list">
                                                {notifications.map((notification) => (
                                                    <li
                                                        key={notification.id}
                                                        className={`notification-item ${notification.read ? "" : "notification-item--unread"}`}
                                                    >
                                                        <div className="notification-item__content">
                                                            <p className="notification-item__title">
                                                                {describeNotification(notification)}
                                                            </p>
                                                            <p className="notification-item__meta">
                                                                {notification.createdAt
                                                                    ? new Date(notification.createdAt).toLocaleString()
                                                                    : ""}
                                                            </p>
                                                        </div>
                                                        {!notification.read && (
                                                            <button
                                                                type="button"
                                                                className="notification-item__action"
                                                                onClick={() => handleNotificationRead(notification.id)}
                                                            >
                                                                Mark read
                                                            </button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="profile-menu" ref={profileMenuRef}>
                            <button
                                type="button"
                                className="profile-menu__trigger"
                                onClick={handleProfileToggle}
                                aria-expanded={isProfileMenuOpen}
                            >
                                {user ? `Welcome, ${user.username ?? user.email}` : "Account"}
                                <span className="profile-menu__chevron">▾</span>
                            </button>
                            {isProfileMenuOpen && (
                                <div className="profile-menu__dropdown">
                                    <button
                                        type="button"
                                        className="profile-menu__item"
                                        onClick={handleEditInfo}
                                        disabled={!user}
                                    >
                                        Edit information
                                    </button>
                                    <button
                                        type="button"
                                        className="profile-menu__item profile-menu__item--danger"
                                        onClick={handleSignOut}
                                    >
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

            <section className="hero-banner">
                <div className="hero-content">
                    <p className="hero-eyebrow">Community marketplace</p>
                    <h1>Share your pantry, discover local flavours</h1>
                    <p>
                        Inspired by Save-On-Foods, explore handcrafted bundles and reward-worthy groceries from neighbours near you.
                    </p>
                </div>
            </section>

            {/* Main layout: left column + tabs */}
            <section className="homepage-content">
                    <div className="homepage-layout">
                        {/* LEFT COLUMN – My Selling List */}
                        <aside className="sidebar">
                            <h3 className="sidebar-title">My Selling List</h3>
                            <p className="sidebar-helper">
                                Items you have listed on the marketplace.
                            </p>

                            {marketItems.filter((item) => item.sellerId === user?.id).length === 0 &&
                            !marketState.loading ? (
                                <div className="selling-list">
                                    <p className="selling-empty">
                                        You have not listed any items yet.
                                    </p>
                                </div>
                            ) : (
                                <ul className="selling-list">
                                    {marketItems
                                        .filter((item) => item.sellerId === user?.id)
                                        .map((item) => (
                                            <li key={`sell-${item.id}`} className="selling-item">
                                                <div className="selling-item__content">
                                                    <div className="selling-item__thumb">
                                                        {item.imagePath ? (
                                                            <Image
                                                                src={item.imagePath}
                                                                alt={item.name}
                                                                width={48}
                                                                height={48}
                                                            />
                                                        ) : (
                                                            <span>No image</span>
                                                        )}
                                                    </div>
                                                    <div className="selling-item__info">
                                                        <strong>{item.name}</strong>
                                                        <span>
                                                            {item.price !== null && item.price !== undefined
                                                                ? ` • $${Number(item.price).toFixed(2)}`
                                                                : ""}
                                                        </span>
                                                        <div className="selling-meta">
                                                            <span>Qty: {item.quantity ?? 0}</span>
                                                            <span
                                                                className={`category-pill selling-meta__category ${
                                                                    item.category ? "" : "category-pill--muted"
                                                                }`}
                                                            >
                                                                {getCategoryLabel(item.category)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="selling-item__actions">
                                                    <button
                                                        type="button"
                                                        className="selling-action-button"
                                                        onClick={() => handleEditItem(item)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="selling-action-button selling-action-button--danger"
                                                        onClick={() => handleUnlistItem(item)}
                                                        disabled={unlistState.loadingId === item.id}
                                                    >
                                                        {unlistState.loadingId === item.id ? "Unlisting…" : "Unlist"}
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                </ul>
                            )}

                            <div className="cart-card">
                                <h4>Shopping cart</h4>
                                {cartItems.length === 0 ? (
                                    <p className="selling-empty">No items yet.</p>
                                ) : (
                                    <ul className="cart-list">
                                        {cartItems.map((item) => {
                                            const quantityInputId = `cart-qty-${item.id}`;
                                            const available = getAvailableQuantity(item.id) ?? item.availableQuantity ?? item.quantity ?? 1;
                                            const maxQuantity = Math.max(1, Math.floor(Number(available)));
                                            return (
                                                <li key={`cart-${item.id}`}>
                                                    <div className="cart-item-row">
                                                        <div>
                                                            <span className="cart-item-name">{item.name}</span>
                                                            <span className="cart-item-price">
                                                                {item.price !== null && item.price !== undefined
                                                                    ? `$${Number(item.price).toFixed(2)}`
                                                                    : "$0.00"}
                                                            </span>
                                                            <span
                                                                className={`cart-item-category category-pill ${
                                                                    item.category ? "" : "category-pill--muted"
                                                                }`}
                                                            >
                                                                {getCategoryLabel(item.category)}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFromCart(item.id)}
                                                        >
                                                            remove
                                                        </button>
                                                    </div>
                                                    <div className="cart-item-controls">
                                                        <label htmlFor={quantityInputId} className="cart-quantity-control">
                                                            <span>Qty</span>
                                                            <input
                                                                id={quantityInputId}
                                                                type="number"
                                                                min={1}
                                                                max={maxQuantity}
                                                                value={item.quantity ?? 1}
                                                                onChange={(event) =>
                                                                    handleCartQuantityChange(item.id, event.target.value)
                                                                }
                                                            />
                                                        </label>
                                                        <span className="cart-item-available">
                                                            {maxQuantity} available
                                                        </span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {cartState.error && (
                                    <p className="helper-text error">{cartState.error}</p>
                                )}
                                {cartState.success && (
                                    <p className="helper-text success">{cartState.success}</p>
                                )}
                                <button
                                    type="button"
                                    className="primary-button wide"
                                    onClick={checkoutCart}
                                    disabled={cartState.loading || cartItems.length === 0}
                                >
                                    {cartState.loading ? "Sending…" : "Checkout"}
                                </button>
                            </div>
                        </aside>

                        {/* RIGHT – Tabs + content */}
                        <div className="main-panel">
                            {/* Tabs */}
                            <div className="tabs">
                            <button
                                className={`tab hover-grow-small ${activeTab === "my-groceries"
                                        ? "tab--active"
                                        : ""
                                    }`}
                                onClick={() => setActiveTab("my-groceries")}
                            >
                                My Groceries
                            </button>

                                <button
                                    className={`tab hover-grow-small ${activeTab === "local-marketplace"
                                            ? "tab--active"
                                            : ""
                                        }`}
                                    onClick={() => setActiveTab("local-marketplace")}
                                >
                                    Local Marketplace
                                </button>
                            </div>

                            {/* Tab content */}
                            <div className="tab-panel">
                                {activeTab === "my-groceries" && (
                                    <div className="tab-section">
                                        <h2 className="tab-heading">
                                            My groceries
                                        </h2>
                                        <p className="tab-text">
                                            Track what you have at home, what’s
                                            expiring soon, and decide what to
                                            share or sell.
                                        </p>
                                        <div className="filter-bar">
                                            <input
                                                type="search"
                                                className="filter-input"
                                                placeholder="Search by item name..."
                                                value={inventoryFilters.search}
                                                onChange={(event) =>
                                                    setInventoryFilters((prev) => ({
                                                        ...prev,
                                                        search: event.target.value,
                                                    }))
                                                }
                                            />
                                            <select
                                                className="filter-select"
                                                value={inventoryFilters.sort}
                                                onChange={(event) =>
                                                    setInventoryFilters((prev) => ({
                                                        ...prev,
                                                        sort: event.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="expiry">Expiry (soonest first)</option>
                                                <option value="expiryLatest">Expiry (latest first)</option>
                                                <option value="quantity">Quantity (low → high)</option>
                                                <option value="quantityHigh">Quantity (high → low)</option>
                                                <option value="priceLow">Price (low → high)</option>
                                                <option value="priceHigh">Price (high → low)</option>
                                            </select>
                                        </div>
                                        {itemsState.error && (
                                            <p className="helper-text error">
                                                {itemsState.error}
                                            </p>
                                        )}
                                        <div className="category-strip marketplace-filter">
                                            {categoryShortcuts.map((category) => (
                                                <button
                                                    key={category.value ?? "all"}
                                                    className={selectedCategory === category.value ? "active" : ""}
                                                    type="button"
                                                    onClick={() => handleCategorySelect(category.value)}
                                                >
                                                    <p>{category.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="groceries-grid">
                                            {filteredInventoryItems.map((item) => (
                                                <article
                                                    className={`grocery-card ${
                                                        item.sellerId !== user?.id ? "is-other" : ""
                                                    }`}
                                                    key={item.id}
                                                >
                                                    {canManageItem(item) ? (
                                                        <div className="grocery-card__overlay">
                                                            <button
                                                                type="button"
                                                                className="grocery-card__overlay-button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditItem(item);
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            {item.type !== "marketplace" && (
                                                                <button
                                                                    type="button"
                                                                    className="grocery-card__overlay-button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleSellItem(item);
                                                                    }}
                                                                >
                                                                    Sell
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="grocery-card__overlay grocery-card__overlay--purchase">
                                                            <label htmlFor={quantityInputId} className="quantity-selector">
                                                                <span>Qty</span>
                                                                <input
                                                                    id={quantityInputId}
                                                                    type="number"
                                                                    min={1}
                                                                    max={maxSelectable}
                                                                    value={selectionValue}
                                                                    onChange={(event) =>
                                                                        handleSelectionChange(item.id, event.target.value, maxSelectable)
                                                                    }
                                                                    disabled={outOfStock || isInCart(item.id)}
                                                                />
                                                                <small>of {maxSelectable}</small>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                className={`grocery-card__overlay-button ${isInCart(item.id) ? "grocery-card__overlay-button--disabled" : ""}`}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    addToCart(item);
                                                                }}
                                                                disabled={isInCart(item.id) || outOfStock}
                                                            >
                                                                {outOfStock ? "Sold out" : isInCart(item.id) ? "In cart" : "Add to cart"}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="grocery-card__image-wrap">
                                                        {item.imagePath ? (
                                                            <Image
                                                                src={item.imagePath}
                                                                alt={item.name}
                                                                width={160}
                                                                height={160}
                                                                className="grocery-card__image"
                                                            />
                                                        ) : (
                                                            <div className="grocery-card__image--placeholder">
                                                                No image
                                                            </div>
                                                        )}
                                                        <span
                                                            className={`grocery-card__category-pill category-pill ${
                                                                item.category ? "" : "category-pill--muted"
                                                            }`}
                                                        >
                                                            {getCategoryLabel(item.category)}
                                                        </span>
                                                        <span className="grocery-card__type">
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                    <div className="grocery-card__body">
                                                        <h3>{item.name}</h3>
                                                        <p className="grocery-card__price">
                                                            {item.price !== null && item.price !== undefined
                                                                ? `$${Number(item.price).toFixed(2)}`
                                                                : "—"}
                                                        </p>
                                                        <dl className="grocery-card__meta">
                                                            <div>
                                                                <dt>Quantity</dt>
                                                                <dd>{item.quantity ?? "0"}</dd>
                                                            </div>
                                                            <div>
                                                                <dt>Expires</dt>
                                                                <dd>
                                                                    {item.expiryDate
                                                                        ? new Date(item.expiryDate).toLocaleDateString()
                                                                        : "—"}
                                                                </dd>
                                                            </div>
                                                        </dl>
                                                    </div>
                                                </article>
                                                    )) }
                                            <button
                                                type="button"
                                                className="grocery-card grocery-card--add"
                                                onClick={openNewItemModal}
                                                disabled={!user}
                                            >
                                                <span className="grocery-card--add__icon">+</span>
                                                <span>Add new item</span>
                                            </button>
                                        </div>
                                        {filteredInventoryItems.length === 0 && !itemsState.loading && (
                                            <p className="helper-text">
                                                {inventoryItems.length === 0
                                                    ? "You have not added any groceries yet."
                                                    : "No groceries match this category yet."}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {activeTab === "local-marketplace" && (
                                    <div className="tab-section">
                                        <h2 className="tab-heading">
                                            Local Marketplace
                                        </h2>
                                        <p className="tab-text">
                                            Browse groceries your neighbours are
                                            selling or giving away near you.
                                        </p>
                                        <div className="filter-bar">
                                            <input
                                                type="search"
                                                className="filter-input"
                                                placeholder="Search by item name..."
                                                value={marketFilters.search}
                                                onChange={(event) =>
                                                    setMarketFilters((prev) => ({
                                                        ...prev,
                                                        search: event.target.value,
                                                    }))
                                                }
                                            />
                                            <select
                                                className="filter-select"
                                                value={marketFilters.sort}
                                                onChange={(event) =>
                                                    setMarketFilters((prev) => ({
                                                        ...prev,
                                                        sort: event.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="expiry">Expiry (soonest first)</option>
                                                <option value="expiryLatest">Expiry (latest first)</option>
                                                <option value="quantity">Quantity (low → high)</option>
                                                <option value="quantityHigh">Quantity (high → low)</option>
                                                <option value="priceLow">Price (low → high)</option>
                                                <option value="priceHigh">Price (high → low)</option>
                                            </select>
                                        </div>
                                        <div className="category-strip marketplace-filter">
                                            {categoryShortcuts.map((category) => (
                                                <button
                                                    key={`market-${category.value ?? "all"}`}
                                                    className={selectedCategory === category.value ? "active" : ""}
                                                    type="button"
                                                    onClick={() => handleCategorySelect(category.value)}
                                                >
                                                    <p>{category.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                        {marketState.error && (
                                            <p className="helper-text error">{marketState.error}</p>
                                        )}
                                        {unlistState.error && (
                                            <p className="helper-text error">{unlistState.error}</p>
                                        )}
                                        <div className="groceries-grid">
                                            {filteredMarketplaceItems.map((item) => {
                                                const outOfStock = Number(item.quantity ?? 0) <= 0;
                                                const quantityInputId = `marketplace-qty-${item.id}`;
                                                const maxSelectable = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
                                                const selectionValue = cartSelections[item.id] ?? 1;
                                                return (
                                                <article
                                                    className={`grocery-card ${item.sellerId !== user?.id ? "is-other" : ""}`}
                                                    key={`${item.id}-market`}
                                                >
                                                    {canManageItem(item) ? (
                                                        <div className="grocery-card__overlay">
                                                            <button
                                                                type="button"
                                                                className="grocery-card__overlay-button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditItem(item);
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="grocery-card__overlay-button grocery-card__overlay-button--danger"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleUnlistItem(item);
                                                                }}
                                                                disabled={unlistState.loadingId === item.id}
                                                            >
                                                                {unlistState.loadingId === item.id
                                                                    ? "Unlisting…"
                                                                    : "Unlist"}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="grocery-card__overlay">
                                                            <button
                                                                type="button"
                                                                className={`grocery-card__overlay-button ${isInCart(item.id) ? "grocery-card__overlay-button--disabled" : ""}`}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    addToCart(item);
                                                                }}
                                                                disabled={isInCart(item.id)}
                                                            >
                                                                {isInCart(item.id) ? "In cart" : "Add to cart"}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="grocery-card__image-wrap">
                                                        {item.imagePath ? (
                                                            <Image
                                                                src={item.imagePath}
                                                                alt={item.name}
                                                                width={160}
                                                                height={160}
                                                                className="grocery-card__image"
                                                            />
                                                        ) : (
                                                            <div className="grocery-card__image--placeholder">
                                                                No image
                                                            </div>
                                                        )}
                                                        <span
                                                            className={`grocery-card__category-pill category-pill ${
                                                                item.category ? "" : "category-pill--muted"
                                                            }`}
                                                        >
                                                            {getCategoryLabel(item.category)}
                                                        </span>
                                                        <span className="grocery-card__type">
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                    <div className="grocery-card__body">
                                                        <h3>{item.name}</h3>
                                                        <p className="grocery-card__price">
                                                            {item.price !== null && item.price !== undefined
                                                                ? `$${Number(item.price).toFixed(2)}`
                                                                : "—"}
                                                        </p>
                                                        <dl className="grocery-card__meta">
                                                            <div>
                                                                <dt>Quantity</dt>
                                                                <dd>{item.quantity ?? "0"}</dd>
                                                            </div>
                                                            <div>
                                                                <dt>Expires</dt>
                                                                <dd>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}</dd>
                                                            </div>
                                                        </dl>
                                                    </div>
                                                </article>
                                                    );
                                                })}
                                        </div>
                                        <div className="groceries-grid">
                                        </div>
                                        {filteredMarketplaceItems.length === 0 && !marketState.loading && (
                                            <p className="helper-text">
                                                {marketplaceItems.length === 0
                                                    ? "No marketplace items yet."
                                                    : "No marketplace items match this category yet."}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </section>
            </div>
            <div
                className="chatbot-container"
                onMouseEnter={handleChatbotInteractionStart}
                onMouseLeave={handleChatbotInteractionEnd}
                onBlurCapture={handleChatbotFocusOut}
            >
                {chatbotState === "speaking" && (
                    <div className="chatbot-bubble" aria-live="polite">
                        <Image
                            src="/speechbubble.png"
                            alt="Chatbot speech bubble"
                            width={260}
                            height={180}
                            className="chatbot-bubble-image"
                        />
                        <div className="chatbot-bubble-content">
                            <p className="chatbot-bubble-text">Have you eaten today?</p>
                            <div className="chatbot-bubble-buttons">
                                <button
                                    type="button"
                                    className="chatbot-bubble-button"
                                    onClick={handleChatbotYes}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    className="chatbot-bubble-button"
                                    onClick={handleChatbotNo}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <button
                    type="button"
                    className="chatbot-trigger"
                    onFocus={handleChatbotInteractionStart}
                    aria-label="Open SaveOurFoods chatbot"
                >
                    <Image
                        src={chatbotImageSrc}
                        alt="SaveOurFoods chatbot"
                        width={140}
                        height={140}
                        className="chatbot-image"
                    />
                </button>
            </div>
            <IngredientPopup
                isOpen={isIngredientPopupOpen}
                onClose={handleIngredientPopupClose}
                onConfirm={handleIngredientConfirm}
                sellerId={user?.id ?? null}
            />
            {isModalOpen && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingItem ? "Edit item" : "Add new item"}</h3>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => {
                                    setModalOpen(false);
                                    setEditingItem(null);
                                }}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <form className="modal-form" onSubmit={handleSaveItem}>
                            <label className="field">
                                <span>Food photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploadState.uploading || createState.loading}
                                />
                                {uploadState.error && (
                                    <p className="helper-text error">{uploadState.error}</p>
                                )}
                                {enrichState.loading && (
                                    <p className="helper-text">Analyzing image…</p>
                                )}
                            </label>
                            <label className="field">
                                <span>Name</span>
                                <input
                                    type="text"
                                    name="name"
                                    value={newItem.name}
                                    onChange={handleNewItemChange}
                                    required
                                />
                            </label>
                            <label className="field">
                                <span>Quantity</span>
                                <input
                                    type="number"
                                    name="quantity"
                                    min="0"
                                    value={newItem.quantity}
                                    onChange={handleNewItemChange}
                                    required
                                />
                            </label>
                            <label className="field">
                                <span>Category</span>
                                <select
                                    name="category"
                                    value={newItem.category}
                                    onChange={handleNewItemChange}
                                    required
                                >
                                    <option value="">Select a category</option>
                                    {ITEM_CATEGORIES.map((category) => (
                                        <option key={category.value} value={category.value}>
                                            {category.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Category</span>
                                <select
                                    name="category"
                                    value={newItem.category}
                                    onChange={handleNewItemChange}
                                >
                                    <option value="">Select category</option>
                                    {ITEM_CATEGORIES.map((category) => (
                                        <option key={category.value} value={category.value}>
                                            {category.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Expiry date</span>
                                <input
                                    type="date"
                                    name="expiryDate"
                                    value={newItem.expiryDate}
                                    onChange={handleNewItemChange}
                                />
                            </label>
                            <label className="field">
                                <span>Date of purchase</span>
                                <input
                                    type="date"
                                    name="dateOfPurchase"
                                    value={newItem.dateOfPurchase}
                                    onChange={handleNewItemChange}
                                    required
                                />
                            </label>
                            {createState.error && (
                                <p className="helper-text error">{createState.error}</p>
                            )}
                            {deleteState.error && (
                                <p className="helper-text error">{deleteState.error}</p>
                            )}
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => {
                                        setModalOpen(false);
                                        setEditingItem(null);
                                    }}
                                    disabled={createState.loading || deleteState.loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={createState.loading || deleteState.loading}
                                >
                                    {createState.loading ? "Saving…" : "Save"}
                                </button>
                                {editingItem && (
                                    <button
                                        type="button"
                                        className="danger-button"
                                        onClick={handleDeleteItem}
                                        disabled={deleteState.loading || createState.loading}
                                    >
                                        {deleteState.loading ? "Deleting…" : "Delete"}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {sellDialog.open && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>AI price suggestion</h3>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() =>
                                    setSellDialog({
                                        open: false,
                                        loading: false,
                                        error: null,
                                        suggestion: null,
                                        item: null,
                                    })
                                }
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        {sellDialog.loading && <p>Calculating price…</p>}
                        {sellDialog.error && <p className="helper-text error">{sellDialog.error}</p>}
                        {sellDialog.suggestion && (
                            <>
                                <p className="sell-summary">
                                    Suggested price:
                                </p>
                                <label className="field">
                                    <span>Price (USD)</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={sellDialog.priceInput}
                                        onChange={(event) =>
                                            setSellDialog((prev) => ({
                                                ...prev,
                                                priceInput: event.target.value,
                                            }))
                                        }
                                        disabled={sellDialog.loading}
                                    />
                                </label>
                                <p className="sell-explanation">{sellDialog.suggestion.explanation}</p>
                            </>
                        )}
                        <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                        setSellDialog({
                                            open: false,
                                            loading: false,
                                            error: null,
                                            suggestion: null,
                                            item: null,
                                            priceInput: "",
                                        })
                                    }
                                    disabled={sellDialog.loading}
                                >
                                    Cancel
                                </button>
                            <button
                                type="button"
                                className="primary-button"
                                onClick={confirmSell}
                                disabled={sellDialog.loading || !sellDialog.suggestion}
                            >
                                {sellDialog.loading ? "Listing…" : "Done"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
