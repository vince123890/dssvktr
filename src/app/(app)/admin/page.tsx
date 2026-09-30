import { redirect } from "next/navigation";

/** v4.0: Workflow & margin tier admin moved into Settings (PRD FR-2.1, FR-5.6). */
export default function AdminPage() {
  redirect("/settings");
}
