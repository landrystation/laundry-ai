import "./style.css";

export const metadata = {
  title: "Laundry AI"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}