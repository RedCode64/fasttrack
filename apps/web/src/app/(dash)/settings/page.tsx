import { SettingsForm } from "@/components/SettingsForm";
import { getOrgContext } from "@/lib/queries";

export default async function SettingsPage() {
  const { org } = await getOrgContext();

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Settings
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Business profile, tax defaults, and the margin target your health score measures
          against.
        </p>
      </div>

      <SettingsForm org={org} />
    </>
  );
}
