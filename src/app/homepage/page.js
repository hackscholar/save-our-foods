"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Popup from "../components/ingedientspopup";
import "./homepage.css";

function createEmptyForm() {
  return {
    name: "",
    quantity: "",
    expiryDate: "",
    dateOfPurchase: new Date().toISOString().slice(0, 10),
    imagePath: "",
  };
}

export default function Homepage() {
  const [hasEntered, setHasEntered] = useState(false);
  const [activeTab, setActiveTab] = useState("my-groceries");
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsState, setItemsState] = useState({ loading: false, error: null });
  const [isModalOpen, setModalOpen] = useState(false);
  const [newItem, setNewItem] = useState(createEmptyForm());
  const [createState, setCreateState] = useState({ loading: false, error: null });
  const [uploadState, setUploadState] = useState({ uploading: false, error: null });
  const [enrichState, setEnrichState] = useState({ loading: false, error: null });

  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), 3000);
    return () => clearTimeout(timer);
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

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;
    async function loadItems() {
      setItemsState({ loading: true, error: null });
      try {
        const response = await fetch(`/api/items?sellerId=${user.id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load items.");
        }
        if (!ignore) {
          setItems(data.items ?? []);
          setItemsState({ loading: false, error: null });
        }
      } catch (error) {
        if (!ignore) {
          setItemsState({ loading: false, error: error.message });
        }
      }
    }
    loadItems();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  function refreshItems() {
    if (!user?.id) return;
    setItemsState({ loading: true, error: null });
    fetch(`/api/items?sellerId=${user.id}`)
      .then((res) => res.json().then((data) => [res.ok, data]))
      .then(([ok, data]) => {
        if (!ok) throw new Error(data?.error ?? "Failed to load items.");
        setItems(data.items ?? []);
        setItemsState({ loading: false, error: null });
      })
      .catch((error) => setItemsState({ loading: false, error: error.message }));
  }

  function openNewItemModal() {
    setNewItem(createEmptyForm());
    setUploadState({ uploading: false, error: null });
    setEnrichState({ loading: false, error: null });
    setCreateState({ loading: false, error: null });
    setModalOpen(true);
  }

  function handleNewItemChange(event) {
    const { name, value } = event.target;
    setNewItem((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreateItem(event) {
    event.preventDefault();
    if (!user?.id) return;
    setCreateState({ loading: true, error: null });
    try {
      const payload = {
        ...newItem,
        sellerId: user.id,
        quantity: newItem.quantity ? Number(newItem.quantity) : 0,
        price: null,
        type: "inventory",
        expiryDate: newItem.expiryDate || null,
        dateOfPurchase: newItem.dateOfPurchase || null,
        imagePath: newItem.imagePath || null,
      };
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setModalOpen(false);
      refreshItems();
    } catch (error) {
      setCreateState({ loading: false, error: error.message });
    }
  }
    const [hasEntered, setHasEntered] = useState(false);
    const [activeTab, setActiveTab] = useState("my-groceries"); // "my-groceries" | "local-marketplace"
    const [isPopupOpen, setIsPopupOpen] = useState(false);

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
            ? parsedQuantity
            : prev.quantity,
      }));
      setEnrichState({ loading: false, error: null });
    } catch (error) {
      setUploadState({ uploading: false, error: error.message });
      setEnrichState({ loading: false, error: error.message });
    }
  }

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
                        {user ? (
                            <span className="header-username">Welcome, {user.username ?? user.email}</span>
                        ) : (
                            <span className="header-username">Welcome</span>
                        )}
                    </div>
                </header>

                {/* Main layout: left column + tabs */}
                <section className="homepage-content">
                    <div className="homepage-layout">
                        {/* LEFT COLUMN – My Selling List */}
                        <aside className="sidebar">
                            <h3 className="sidebar-title">My selling list</h3>
                            <p className="sidebar-helper">
                                Add any food or groceries you want to sell or share.
                            </p>

                            <div className="selling-form">
                                <input
                                    className="selling-input"
                                    type="text"
                                    placeholder="e.g. 2L milk (expires Friday)"
                                />
                                <input
                                    className="selling-input"
                                    type="text"
                                    placeholder="Price or ‘free’"
                                />
                                <button className="selling-button">
                                    Add to list
                                </button>
                            </div>

                            <div className="selling-list">
                                <p className="selling-empty">
                                    Your list is empty for now.
                                </p>
                                {/* Later you can map over items here */}
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
                                            {items.map((item) => (
                                                <article className="grocery-card" key={item.id}>
                                                    <div className="grocery-card__header">
                                                        <h3>{item.name}</h3>
                                                        <span className="grocery-card__type">
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                    <dl className="grocery-card__meta">
                                                        <div>
                                                            <dt>Quantity</dt>
                                                            <dd>{item.quantity ?? "0"}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>Expires</dt>
                                                            <dd>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>Price</dt>
                                                            <dd>
                                                                {item.price !== null && item.price !== undefined
                                                                    ? `$${Number(item.price).toFixed(2)}`
                                                                    : "—"}
                                                            </dd>
                                                        </div>
                                                    </dl>
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
                                        {items.length === 0 && !itemsState.loading && (
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
                                        {/* marketplace UI here later */}
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
                            <h3>Add new item</h3>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setModalOpen(false)}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <form className="modal-form" onSubmit={handleCreateItem}>
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
                                    onClick={() => setModalOpen(false)}
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
            <button
                type="button"
                className="ingredients-button hover-grow-small"
                onClick={() => setIsPopupOpen(true)}
            >
                Ingredients Pop Up
            </button>
            <Popup
                isOpen={isPopupOpen}
                onClose={() => setIsPopupOpen(false)}
            />

        </main>
    );
}
