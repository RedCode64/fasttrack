import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { NavLink } from "@/components/NavLink";
import { QuickCreate, type CreatableKind } from "@/components/QuickCreate";
import { SignOutButton } from "@/components/SignOutButton";
import { countOpenInvoices, getOrgContext, loadCreateOptions } from "@/lib/queries";

/** Which entities each sidebar group can create in place. */
const GROUP_CREATE: Record<string, CreatableKind[]> = {
  MONEY: ["budget"],
  "JOBS & CLIENTS": ["client", "job"],
  BILLING: ["expense"],
};

const NAV_GROUPS: { label: string; items: { href: string; name: string; icon: IconName }[] }[] = [
  { label: "OVERVIEW", items: [{ href: "/", name: "Financial Position", icon: "home" }] },
  {
    label: "MONEY",
    items: [
      { href: "/spend", name: "Spend by Category", icon: "spend" },
      { href: "/budgets", name: "Budgets", icon: "budgets" },
      { href: "/tips", name: "Optimization Tips", icon: "tips" },
      { href: "/revenue", name: "Revenue & Receivables", icon: "revenue" },
    ],
  },
  {
    label: "JOBS & CLIENTS",
    items: [
      { href: "/profit", name: "Job Profitability", icon: "profit" },
      { href: "/jobs", name: "Jobs", icon: "jobs" },
      { href: "/clients", name: "Clients", icon: "clients" },
    ],
  },
  {
    label: "BILLING",
    items: [
      { href: "/invoices", name: "Invoices", icon: "invoices" },
      { href: "/expenses", name: "Expenses", icon: "expenses" },
    ],
  },
  {
    label: "MORE",
    items: [
      { href: "/reports", name: "Reports & Export", icon: "reports" },
      { href: "/settings", name: "Settings", icon: "settings" },
    ],
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { orgId, org, userName } = await getOrgContext();
  const openInvoices = await countOpenInvoices(orgId);
  const createOptions = await loadCreateOptions(orgId);
  const monthChip = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <aside
        style={{
          width: 252,
          flex: "none",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 15px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 8px 4px" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Icon name="bolt" />
          </div>
          <span style={{ font: "800 19px/1 var(--font-jakarta)", letterSpacing: "-.03em" }}>
            FastTrack
          </span>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", marginTop: 16, paddingRight: 2 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 15 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 11px 9px",
                }}
              >
                <span
                  style={{
                    font: "700 10px/1 var(--font-jakarta)",
                    letterSpacing: ".11em",
                    color: "var(--muted-3)",
                  }}
                >
                  {group.label}
                </span>
                {GROUP_CREATE[group.label] && (
                  <QuickCreate
                    label={group.label}
                    kinds={GROUP_CREATE[group.label]}
                    clients={createOptions.clients}
                    categories={createOptions.categories}
                  />
                )}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.name}
                  icon={<Icon name={item.icon} />}
                  badge={item.href === "/invoices" ? openInvoices : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        <div
          style={{
            marginTop: 12,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "14px 15px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: 12.5,
              color: "var(--navy)",
            }}
          >
            <Icon name="lock" /> Read-only
          </div>
          <p style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.55, color: "var(--muted)" }}>
            Estimates and invoices are created in the FastTrack app. This dashboard is for
            reviewing your numbers.
          </p>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 66,
            flex: "none",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "0 26px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 11,
              padding: "9px 13px",
              maxWidth: 400,
              flex: 1,
              color: "var(--muted-2)",
            }}
          >
            <Icon name="search" />
            <span style={{ fontSize: 13.5 }}>Search jobs, clients, invoices…</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "8px 13px",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--ink)",
              }}
            >
              <Icon name="cal" /> {monthChip}
            </span>
            <SignOutButton />
            <div style={{ width: 1, height: 26, background: "var(--border)" }} />
            <Link
              href="/settings"
              style={{ display: "flex", alignItems: "center", gap: 11, color: "inherit" }}
            >
              <div
                style={{
                  width: 37,
                  height: 37,
                  borderRadius: "50%",
                  background: "var(--navy)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {initials(userName)}
              </div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{userName}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted-2)" }}>{org.name}</div>
              </div>
            </Link>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "26px 30px 64px",
              animation: "fadeUp .18s ease",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
