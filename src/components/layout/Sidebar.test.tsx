// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Actor } from "@/types/database";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/proposals" }));
vi.mock("@/app/login/actions", () => ({ logoutAction: vi.fn() }));

const profile = {
  id: "me",
  full_name: "Maria Kusuma",
  app_role: { name: "Sales Executive", functional_roles: ["SALESPERSON"], is_active: true },
} as unknown as Actor;

const drawer = () => document.getElementById("app-drawer") as HTMLElement;

describe("Sidebar — drawer di handphone / iPad (PRD FR-5.8)", () => {
  it("hanya menampilkan menu yang diizinkan server", () => {
    render(<Sidebar profile={profile} menus={["overview", "quotations", "projects"]} />);
    expect(screen.getByRole("link", { name: "Official Quotation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cost Structure (M/C/R)" })).not.toBeInTheDocument();
  });

  it("menu aktif ditandai sesuai halaman", () => {
    render(<Sidebar profile={profile} menus={["overview", "quotations"]} />);
    expect(screen.getByRole("link", { name: "Official Quotation" }).className).toContain("text-primary");
    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("bg-blue-50");
  });

  it("drawer tertutup di awal, terbuka lewat tombol hamburger", async () => {
    const user = userEvent.setup();
    render(<Sidebar profile={profile} menus={["overview"]} />);
    const burger = screen.getByRole("button", { name: "Buka menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(drawer().className).toContain("-translate-x-full");

    await user.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "true");
    expect(drawer().className).toContain("translate-x-0");
    expect(drawer().className).not.toContain("-translate-x-full");
  });

  it("menutup dengan Esc, dengan tombol tutup, dan dengan klik overlay", async () => {
    const user = userEvent.setup();
    render(<Sidebar profile={profile} menus={["overview"]} />);
    const burger = screen.getByRole("button", { name: "Buka menu" });

    await user.click(burger);
    await user.keyboard("{Escape}");
    expect(burger).toHaveAttribute("aria-expanded", "false");

    await user.click(burger);
    await user.click(screen.getByRole("button", { name: "Tutup menu" }));
    expect(burger).toHaveAttribute("aria-expanded", "false");

    await user.click(burger);
    const overlay = document.querySelector('div[aria-hidden="true"]') as HTMLElement;
    await user.click(overlay);
    expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  it("menutup otomatis setelah memilih halaman", async () => {
    const user = userEvent.setup();
    render(<Sidebar profile={profile} menus={["overview", "quotations"]} />);
    const burger = screen.getByRole("button", { name: "Buka menu" });
    await user.click(burger);
    await user.click(screen.getByRole("link", { name: "Official Quotation" }));
    expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  it("halaman di belakang tidak ikut menggulir saat drawer terbuka, lalu dipulihkan", async () => {
    const user = userEvent.setup();
    render(<Sidebar profile={profile} menus={["overview"]} />);
    expect(document.body.style.overflow).toBe("");
    await user.click(screen.getByRole("button", { name: "Buka menu" }));
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });

  it("tombol di drawer cukup besar untuk disentuh dan nama pengguna tampil", () => {
    render(<Sidebar profile={profile} menus={["overview"]} />);
    expect(screen.getByText("Maria Kusuma")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buka menu" }).className).toContain("h-11");
    expect(screen.getByRole("link", { name: "Overview" }).className).toContain("min-h-11");
  });
});
