import { ComponentType, lazy, useState } from "react";

/**
 * React.lazy that can be loaded ahead of time with `preload()` (e.g. while the
 * player is still on the menu). Once loaded it renders straight away, without
 * suspending.
 */
export function lazyWithPreload<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<{ default: ComponentType<P> }> | undefined;

  const preload = () =>
    (pending ??= load().then((module) => {
      loaded = module.default;
      return module;
    }));
  const Lazy = lazy(preload);

  function Preloadable(props: P) {
    // Picked once per mount: switching from Lazy to the loaded component
    // later would remount it and lose its state
    const [Component] = useState<ComponentType<P>>(() => loaded ?? Lazy);
    return <Component {...props} />;
  }

  return Object.assign(Preloadable, { preload });
}
