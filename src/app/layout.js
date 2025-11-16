import "./globals.css";

export const metadata = {
  title: "SaveMyFoods",
  description: "Grocery sharing marketplace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
