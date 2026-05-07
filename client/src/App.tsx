import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { User, Product } from "./types";
import { Login }           from "./pages/Login";
import { POS }             from "./pages/POS";
import { Inventory }       from "./pages/Inventory";
import { SalesHistory }    from "./pages/SalesHistory";
import { Customers }       from "./pages/Customers";
import { Orders }          from "./pages/Orders";
import { Taxes }           from "./pages/Taxes";
import { Payments }        from "./pages/Payments";
import { Settings }        from "./pages/Settings";
import { DataManager }     from "./pages/DataManager";
import { Coupons }         from "./pages/Coupons";
import UserManagement      from "./pages/UserManagement";
import MobileScan          from "./pages/MobileScan";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ReceiptModal }    from "./components/ReceiptModal";

type Tab = "pos" | "inventory" | "sales" | "customers" | "orders" | "taxes" | "payments" | "coupons" | "users" | "settings" | "data";

function restoreUser(): User | null {
  try {
    const stored = localStorage.getItem("pos_user");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const { token, ...userFields } = parsed;
    if (!token || !userFields.role) return null;
    return userFields as User;
  } catch {
    return null;
  }
}

/* Mobile scan runs outside auth — check once at module load */
const MOBILE_SCAN_ROUTE = window.location.pathname.startsWith("/mobile-scan");
const MOBILE_SCAN_SESSION = MOBILE_SCAN_ROUTE
  ? new URLSearchParams(window.location.search).get("session")
  : null;

/* The main POS application (always renders when not on mobile-scan route) */
function MainPOS() {
  const [user, setUser]                       = useState<User | null>(restoreUser);
  const [activeTab, setActiveTab]             = useState<Tab>("pos");
  const [products, setProducts]               = useState<Product[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    try {
      const stored = localStorage.getItem("pos_user");
      const token  = stored ? JSON.parse(stored)?.token : null;
      const res    = await fetch("/api/products", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pos_user");
    setUser(null);
    setProducts([]);
    setActiveTab("pos");
  };

  if (!user) return <Login onLogin={setUser} />;

  const renderPage = () => {
    switch (activeTab) {
      case "pos":
        return (
          <POS
            user={user}
            products={products}
            onCheckout={fetchProducts}
            onShowReceipt={setSelectedReceipt}
          />
        );
      case "inventory":
        return <Inventory products={products} onUpdate={fetchProducts} />;
      case "sales":
        return <SalesHistory onShowReceipt={setSelectedReceipt} />;
      case "customers":
        return <Customers />;
      case "orders":
        return <Orders />;
      case "taxes":
        return <Taxes />;
      case "payments":
        return <Payments />;
      case "coupons":
        return <Coupons />;
      case "users":
        return <UserManagement />;
      case "settings":
        return <Settings />;
      case "data":
        return <DataManager />;
      default:
        return null;
    }
  };

  return (
    <>
      <DashboardLayout
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </DashboardLayout>

      <AnimatePresence>
        {selectedReceipt && (
          <ReceiptModal
            key="receipt-modal"
            sale={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  if (MOBILE_SCAN_ROUTE) {
    return <MobileScan sessionId={MOBILE_SCAN_SESSION} />;
  }
  return <MainPOS />;
}
