import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lazyWithPreload } from "./lazyWithPreload";

const Greeting = ({ name }: { name: string }) => <p>Hola, {name}</p>;

describe("lazyWithPreload", () => {
  it("suspends until the component has loaded", async () => {
    const Lazy = lazyWithPreload(async () => ({ default: Greeting }));

    render(
      <Suspense fallback={<p>Cargando</p>}>
        <Lazy name="Ana" />
      </Suspense>
    );

    expect(screen.getByText("Cargando")).toBeInTheDocument();
    expect(await screen.findByText("Hola, Ana")).toBeInTheDocument();
  });

  it("renders straight away once preloaded, and loads only once", async () => {
    let loads = 0;
    const Lazy = lazyWithPreload(async () => {
      loads++;
      return { default: Greeting };
    });

    await Promise.all([Lazy.preload(), Lazy.preload()]);
    render(
      <Suspense fallback={<p>Cargando</p>}>
        <Lazy name="Ana" />
      </Suspense>
    );

    expect(screen.getByText("Hola, Ana")).toBeInTheDocument();
    expect(loads).toBe(1);
  });
});
