// Sets the flag that React Router's Vite plugin injects in dev/test environments.
// Must be in a setup file so it runs before any test module is imported.
Object.assign(globalThis, {
  __vite_plugin_react_preamble_installed__: true,
});
