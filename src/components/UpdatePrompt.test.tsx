import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpdatePrompt from "./UpdatePrompt";
import { same } from "../i18n/lang";

const sw = vi.hoisted(() => ({
  offlineReady: false,
  needRefresh: false,
  setOfflineReady: vi.fn(),
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    offlineReady: [sw.offlineReady, sw.setOfflineReady],
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

beforeEach(() => {
  sw.offlineReady = false;
  sw.needRefresh = false;
  vi.clearAllMocks();
});

describe("UpdatePrompt", () => {
  it("shows nothing until the service worker has news", () => {
    render(<UpdatePrompt />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nueva versión/)).not.toBeInTheDocument();
  });

  it("says when the app works offline", () => {
    sw.offlineReady = true;
    render(<UpdatePrompt />);

    expect(screen.getByText("Lista para jugar sin conexión")).toBeInTheDocument();
  });

  it("lets the player update now or later", () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Más tarde" }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
