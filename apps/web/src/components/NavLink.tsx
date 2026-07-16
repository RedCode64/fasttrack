"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function NavLink({ href, label, icon, badge }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href} className={`nav-link${isActive ? " active" : ""}`}>
      <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 20,
            background: isActive ? "#cfe7d8" : "#eef1ec",
            color: isActive ? "var(--green)" : "var(--muted-2)",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
