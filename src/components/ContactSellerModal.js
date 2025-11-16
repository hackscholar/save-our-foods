"use client";
import { useState } from "react";

export default function ContactSellerModal({ isOpen, onClose, item, seller, buyerId, onSuccess }) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/items/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: item.id,
          buyerId: buyerId,
          message: message.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Success!
      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
      setMessage("");
    } catch (err) {
      setError(err.message || "Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage("");
      setError(null);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Contact the Seller</h2>
          <button
            className="modal-close"
            onClick={handleClose}
            disabled={isSending}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="item-preview">
            <h3>{item.name}</h3>
            {item.price && <p className="item-price">${Number(item.price).toFixed(2)}</p>}
            {item.quantity && <p className="item-quantity">Quantity: {item.quantity}</p>}
          </div>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Your Message to the Seller</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! I'm interested in purchasing this item. Please let me know when we can arrange pickup..."
                rows={6}
                disabled={isSending}
                required
              />
            </label>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={handleClose}
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSending || !message.trim()}
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}

