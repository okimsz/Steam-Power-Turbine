// Runs before Three.js and app imports to diagnose failures during startup.
(() => {
  const status = document.getElementById("startupStatus");
  let rendered = false,
    failed = false;
  function fail(message) {
    if (failed) return;
    failed = true;
    if (status) status.hidden = true;
    const panel = document.createElement("div");
    panel.id = "startupError";
    panel.className = "startup-error";
    panel.setAttribute("role", "alert");
    const title = document.createElement("strong");
    title.textContent = "3D startup problem";
    const detail = document.createElement("p");
    detail.textContent = message;
    const reload = document.createElement("button");
    reload.textContent = "Reload simulator";
    reload.onclick = () => location.reload();
    panel.append(title, detail, reload);
    document.getElementById("stage").appendChild(panel);
  }
  window.__steamStartup = {
    fail,
    frameRendered() {
      rendered = true;
      if (status) status.hidden = true;
    },
  };
  window.addEventListener(
    "error",
    (event) => {
      const source = event.target?.src;
      if (source)
        fail(
          "A required script could not load: " +
            source.split("/").pop() +
            ". Use npm run dev, or open the complete offline HTML.",
        );
      else if (event.message) fail(event.message);
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) =>
    fail(String(event.reason?.message || event.reason)),
  );
  setTimeout(() => {
    if (!rendered && !failed && status)
      status.textContent =
        "The 3D view has not started. Try Ctrl+Shift+R. If this remains, share a screenshot of this message and the browser address.";
  }, 8000);
})();
