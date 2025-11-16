"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import "./homepage.css";

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function createEmptyForm() {
  return {
    name: "",
    quantity: "",
    expiryDate: "",
    dateOfPurchase: toDateInput(new Date()),
    imagePath: "",
  };
}

export default function Homepage() {
  const router = useRouter();
  const profileMenuRef = useRef(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [activeTab, setActiveTab] = useState("my-groceries");
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsState, setItemsState] = useState({ loading: false, error: null });
  const [marketItems, setMarketItems] = useState([]);
  const [marketState, setMarketState] = useState({ loading: false, error: null });
  const [isModalOpen, setModalOpen] = useState(false);
  const [newItem, setNewItem] = useState(createEmptyForm());
  const [editingItem, setEditingItem] = useState(null);
  const [createState, setCreateState] = useState({ loading: false, error: null });
  const [uploadState, setUploadState] = useState({ uploading: false, error: null });
  const [enrichState, setEnrichState] = useState({ loading: false, error: null });
  const [sellDialog, setSellDialog] = useState({
    open: false,
    loading: false,
    error: null,
    suggestion: null,
    item: null,
    priceInput: "",
  });
  const [cartItems, setCartItems] = useState([]);
  const [cartState, setCartState] = useState({ loading: false, error: null, success: null });

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

  async function fetchInventoryItems() {
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
  }

  async function fetchMarketplaceItems() {
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
  }

  useEffect(() => {
    if (!user?.id) return;
    fetchInventoryItems();
  }, [user?.id]);

  useEffect(() => {
    fetchMarketplaceItems();
  }, []);

  function refreshItems() {
    if (user?.id) {
      fetchInventoryItems();
    }
    fetchMarketplaceItems();
  }

  function openNewItemModal() {
    setNewItem(createEmptyForm());
    setEditingItem(null);
    setUploadState({ uploading: false, error: null });
    setEnrichState({ loading: false, error: null });
    setCreateState({ loading: false, error: null });
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

  function addToCart(item) {
    if (!item || item.sellerId === user?.id) return;
    setCartItems((prev) => {
      if (prev.some((entry) => entry.id === item.id)) return prev;
      return [...prev, { id: item.id, name: item.name, price: item.price, sellerId: item.sellerId }];
    });
    setCartState({ loading: false, error: null, success: null });
  }

  function removeFromCart(id) {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function checkoutCart() {
    if (cartItems.length === 0 || !user?.email) {
      setCartState({ loading: false, error: "Cart is empty or missing buyer email.", success: null });
      return;
    }
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
      setCartItems([]);
      if (data.pdf) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${data.pdf}`;
        link.download = data.fileName ?? `savemyfoods-receipt-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setCartState({ loading: false, error: null, success: "Receipt downloaded." });
    } catch (error) {
      setCartState({ loading: false, error: error.message, success: null });
    }
  }

  const inventoryItems = items.filter((item) => item.type !== "marketplace");
  const marketplaceItems = marketItems;
  const canManageItem = (item) => item?.sellerId === user?.id;
  const isInCart = (id) => cartItems.some((item) => item.id === id);

  return (
        <main className="homepage-root">
            {/* INTRO OVERLAY (transparent green → fade out) */}
            <div
                className={`intro-overlay ${hasEntered ? "intro-overlay--fade-out" : ""
                    }`}
            >
                <div className="intro-content">
                    <h1 className="intro-title hover-grow">SaveMyFoods</h1>

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
                {/* Header */}
                <header className="homepage-header">
                    <div className="header-left">
                        <Image
                            src="/icon.png"
                            alt="SaveMyFoods logo"
                            width={50}
                            height={50}
                            className="header-logo"
                        />
                        <span className="header-title">SaveMyFoods</span>
                    </div>
                    <div className="header-right">
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

                {/* Main layout: left column + tabs */}
                <section className="homepage-content">
                    <div className="homepage-layout">
                        {/* LEFT COLUMN – My Selling List */}
                        <aside className="sidebar">
                            <h3 className="sidebar-title">My selling list</h3>
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
                                                        Qty: {item.quantity ?? 0}
                                                    </div>
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
                                        {cartItems.map((item) => (
                                            <li key={`cart-${item.id}`}>
                                                <span>{item.name}</span>
                                                <div>
                                                    <span>
                                                        {item.price !== null && item.price !== undefined
                                                            ? `$${Number(item.price).toFixed(2)}`
                                                            : "$0.00"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFromCart(item.id)}
                                                    >
                                                        remove
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
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
                                My groceries
                            </button>

                                <button
                                    className={`tab hover-grow-small ${activeTab === "local-marketplace"
                                            ? "tab--active"
                                            : ""
                                        }`}
                                    onClick={() => setActiveTab("local-marketplace")}
                                >
                                    Local marketplace
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
                                        {itemsState.error && (
                                            <p className="helper-text error">
                                                {itemsState.error}
                                            </p>
                                        )}
                                        <div className="groceries-grid">
                                            {inventoryItems.map((item) => (
                                                <article className="grocery-card" key={item.id}>
                                                    {canManageItem(item) && (
                                                        <div className="grocery-card__overlay">
                                                            <button
                                                                type="button"
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
                                                        {item.sellerId !== user?.id && (
                                                            <button
                                                                type="button"
                                                                className={`cart-add-button ${isInCart(item.id) ? "cart-add-button--disabled" : ""}`}
                                                                onClick={() => addToCart(item)}
                                                                disabled={isInCart(item.id)}
                                                            >
                                                                {isInCart(item.id) ? "In cart" : "Add to cart"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </article>
                                            ))}
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
                                        {inventoryItems.length === 0 && !itemsState.loading && (
                                            <p className="helper-text">
                                                You have not added any groceries yet.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {activeTab === "local-marketplace" && (
                                    <div className="tab-section">
                                        <h2 className="tab-heading">
                                            Local marketplace
                                        </h2>
                                        <p className="tab-text">
                                            Browse groceries your neighbours are
                                            selling or giving away near you.
                                        </p>
                                        {marketState.error && (
                                            <p className="helper-text error">{marketState.error}</p>
                                        )}
                                        <div className="groceries-grid">
                                            {marketplaceItems.map((item) => (
                                                <article className="grocery-card" key={`${item.id}-market`}>
                                                    {canManageItem(item) && (
                                                        <div className="grocery-card__overlay">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditItem(item);
                                                                }}
                                                            >
                                                                Edit
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
                                                        {item.sellerId !== user?.id && (
                                                            <button
                                                                type="button"
                                                                className="cart-add-button"
                                                                onClick={() => addToCart(item)}
                                                                disabled={isInCart(item.id)}
                                                            >
                                                                {isInCart(item.id) ? "In cart" : "Add to cart"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                        {marketplaceItems.length === 0 && !marketState.loading && (
                                            <p className="helper-text">
                                                No marketplace items yet.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
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
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => {
                                        setModalOpen(false);
                                        setEditingItem(null);
                                    }}
                                    disabled={createState.loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={createState.loading}
                                >
                                    {createState.loading ? "Saving…" : "Save"}
                                </button>
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
