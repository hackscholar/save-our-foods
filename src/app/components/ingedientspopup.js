"use client";

import { useRef, useState } from "react";

export default function Popup({ isOpen, onClose, onConfirm }) {
  const fileInputRef = useRef(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // TODO: replace with real AI call
  async function getIngredientsFromAiMock(file) {
    return `2 tomatoes
1 onion
3 cloves garlic`;
  }

  function parseIngredientString(str) {
    return str
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, index) => {
        const [qty, ...rest] = line.split(" ");
        return {
          id: index,
          name: rest.join(" "),
          quantity: qty || "1",
        };
      });
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const result = await getIngredientsFromAiMock(file);
      setIngredients(parseIngredientString(result));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenFilePicker() {
    fileInputRef.current?.click();
  }

  function updateQuantity(index, value) {
    setIngredients((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: value };
      return copy;
    });
  }

  function handleConfirm() {
    // send ingredients up if handler provided
    if (onConfirm) {
      onConfirm(ingredients);
    }
    // you could also auto-close here if you want:
    // onClose();
    console.log("Confirmed ingredients:", ingredients);
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        {/* X in top-right */}
        <button className="popup-x" onClick={onClose}>
          ×
        </button>

        <h2>Have you cooked today?</h2>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <div className="popup-content">
          {ingredients.length > 0 && (
            <div className="ingredients-list">
              <p className="ingredients-title">
                Ingredients detected — adjust quantities:
              </p>

              {ingredients.map((ing, index) => (
                <div key={ing.id} className="ingredient-row">
                  <span className="ingredient-label">{ing.name}</span>

                  <input
                    className="ingredient-input"
                    value={ing.quantity}
                    onChange={(e) => updateQuantity(index, e.target.value)}
                    placeholder="Qty"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Upload button at the bottom, styled like old close button */}
          <button
            className="popup-button upload-button-full"
            onClick={handleOpenFilePicker}
          >
            {loading ? "Analyzing..." : "Upload a picture"}
          </button>

          {/* Confirm button appears AFTER image / ingredients */}
          {ingredients.length > 0 && (
            <button
              className="popup-button confirm-button-full"
              onClick={handleConfirm}
            >
              Confirm ingredients
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
