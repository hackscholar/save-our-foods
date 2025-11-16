import "./globals.css";

export const metadata = {
  title: "SaveOurFoods",
  description: "Grocery sharing marketplace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
        <head>
        <link rel="icon" href="/icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
