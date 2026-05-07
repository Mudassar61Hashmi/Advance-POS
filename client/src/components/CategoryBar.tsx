import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";

interface CategoryBarProps {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
  counts?: Record<string, number>;
}

const EMOJI_MAP: Record<string, string> = {
  all: "🏪",
  food: "🍔",
  food_beverage: "🍔",
  beverage: "🥤",
  drinks: "🥤",
  bakery: "🥐",
  fruits: "🍎",
  vegetables: "🥦",
  dairy: "🥛",
  meat: "🥩",
  seafood: "🐟",
  snacks: "🍿",
  frozen: "🧊",
  grocery: "🛒",
  pharmacy: "💊",
  medicine: "💊",
  beauty: "💄",
  cosmetics: "💄",
  clothing: "👕",
  fashion: "👕",
  shoes: "👟",
  electronics: "📱",
  mobile: "📱",
  laptop: "💻",
  computers: "💻",
  accessories: "⌨️",
  toys: "🧸",
  sports: "⚽",
  fitness: "⚽",
  books: "📚",
  stationery: "✏️",
  home: "🏠",
  kitchen: "🍳",
  furniture: "🛋️",
  cleaning: "🧹",
  automotive: "🚗",
  tools: "🔧",
  garden: "🌱",
  pet: "🐾",
  pets: "🐾",
};

function getEmoji(category: string): string {
  const key = category.toLowerCase().replace(/[\s-]/g, "_");
  if (EMOJI_MAP[key]) return EMOJI_MAP[key];
  // Try partial match
  for (const [mapKey, emoji] of Object.entries(EMOJI_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return emoji;
  }
  return "📦";
}

function formatLabel(category: string): string {
  return category
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const CategoryBar = ({
  categories,
  active,
  onSelect,
  counts,
}: CategoryBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [categories]);

  // Scroll active item into view when active changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLButtonElement>("[data-active='true']");
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [active]);

  const maskLeft = "linear-gradient(to right, transparent 0%, black 60px)";
  const maskRight = "linear-gradient(to left, transparent 0%, black 60px)";
  const maskBoth =
    "linear-gradient(to right, transparent 0%, black 60px, black calc(100% - 60px), transparent 100%)";
  const maskImage =
    canScrollLeft && canScrollRight
      ? maskBoth
      : canScrollLeft
      ? maskLeft
      : canScrollRight
      ? maskRight
      : "none";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      {/* Scrollable row */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          scrollbarWidth: "none",
          padding: "4px 2px 8px",
          WebkitOverflowScrolling: "touch",
          maskImage,
          WebkitMaskImage: maskImage,
          transition: "mask-image 0.3s ease",
        }}
      >
        {categories.map((cat) => {
          const isActive = cat === active;
          const emoji = getEmoji(cat);
          const label = formatLabel(cat);
          const count = counts?.[cat];

          return (
            <button
              key={cat}
              data-active={isActive ? "true" : "false"}
              onClick={() => onSelect(cat)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "999px",
                border: isActive ? "none" : "1.5px solid var(--theme-border, rgba(0,0,0,0.10))",
                background: isActive ? "transparent" : "var(--theme-surface, #ffffff)",
                color: isActive
                  ? "#ffffff"
                  : "var(--theme-text-secondary, #666)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                fontFamily: "inherit",
                fontSize: "13.5px",
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.01em",
                outline: "none",
                transition:
                  "color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                boxShadow: isActive
                  ? "0 2px 12px rgba(0,0,0,0.18)"
                  : "0 1px 3px rgba(0,0,0,0.06)",
                zIndex: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--theme-accent, #6366f1)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.10)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--theme-accent, #6366f1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--theme-border, rgba(0,0,0,0.10))";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--theme-text-secondary, #666)";
                }
              }}
            >
              {/* Animated gradient background for active state */}
              {isActive && (
                <motion.span
                  layoutId="cat-active-bg"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "999px",
                    background:
                      "linear-gradient(135deg, var(--theme-accent, #6366f1) 0%, var(--theme-accent-dark, #4f46e5) 100%)",
                    zIndex: -1,
                  }}
                />
              )}

              {/* Emoji */}
              <span
                style={{
                  fontSize: "15px",
                  lineHeight: 1,
                  filter: isActive ? "none" : "saturate(0.8)",
                  transition: "filter 0.2s ease",
                }}
              >
                {emoji}
              </span>

              {/* Label */}
              <span style={{ lineHeight: 1 }}>{label}</span>

              {/* Count badge */}
              {count !== undefined && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 5px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    lineHeight: 1,
                    background: isActive
                      ? "rgba(255,255,255,0.25)"
                      : "var(--theme-accent-subtle, rgba(99,102,241,0.10))",
                    color: isActive
                      ? "#ffffff"
                      : "var(--theme-accent, #6366f1)",
                    transition: "background 0.2s ease, color 0.2s ease",
                  }}
                >
                  {count > 999 ? "999+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
