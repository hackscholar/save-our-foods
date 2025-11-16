# Contact Seller Modal - Usage Example

## How to Use the Contact Seller Modal

The `ContactSellerModal` component is a popup that appears when a user wants to buy an item. It allows them to write a custom message to the seller.

### Basic Usage

```jsx
"use client";
import { useState } from "react";
import ContactSellerModal from "@/components/ContactSellerModal";

export default function ItemCard({ item, currentUserId }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBuyClick = () => {
    setIsModalOpen(true);
  };

  const handleSuccess = (response) => {
    console.log("Email sent successfully!", response);
    // You can show a success message to the user here
    alert("Your message has been sent to the seller!");
  };

  return (
    <div>
      {/* Your item card content */}
      <h3>{item.name}</h3>
      <p>${item.price}</p>

      {/* Buy button */}
      <button onClick={handleBuyClick}>Contact Seller</button>

      {/* Modal */}
      <ContactSellerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={item}
        seller={item.seller} // Optional: seller object with name, email, etc.
        buyerId={currentUserId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
```

### Props

- `isOpen` (boolean, required): Controls whether the modal is visible
- `onClose` (function, required): Callback when modal is closed
- `item` (object, required): The item being purchased
  - `id` (string): Item ID
  - `name` (string): Item name
  - `price` (number, optional): Item price
  - `quantity` (number, optional): Item quantity
- `buyerId` (string, required): The ID of the buyer (current user)
- `seller` (object, optional): Seller information (not required, fetched from API)
- `onSuccess` (function, optional): Callback when email is sent successfully

### Example with Full Item Object

```jsx
const item = {
  id: "abc-123",
  name: "Fresh Tomatoes",
  price: 4.99,
  quantity: 3,
  sellerId: "seller-uuid",
};

const currentUserId = "buyer-uuid";

<ContactSellerModal
  isOpen={true}
  onClose={() => {}}
  item={item}
  buyerId={currentUserId}
  onSuccess={(data) => {
    console.log("Success!", data);
  }}
/>;
```

### What Happens When User Clicks "Send"

1. The modal validates the message (must not be empty)
2. Sends a POST request to `/api/items/buy` with:
   - `itemId`: The item's ID
   - `buyerId`: The buyer's user ID
   - `message`: The custom message from the textarea
3. The backend:
   - Fetches item and user details from Supabase
   - Sends an email to the seller with the buyer's message
   - Returns success response
4. The modal closes and calls `onSuccess` callback

### Email Content

The seller will receive an email containing:

- Item details (name, price, quantity)
- Buyer information (name, email)
- **The custom message from the buyer** (highlighted in a special section)
- Instructions to contact the buyer
