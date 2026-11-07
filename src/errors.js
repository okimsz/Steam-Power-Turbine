window.addEventListener("error", (event) => {
  if (document.getElementById("startupError")) return;
  const panel = document.createElement("div");
  panel.id = "startupError";
  panel.className = "startup-error";
  panel.setAttribute("role", "alert");
  panel.textContent =
    "The simulator could not run: " +
    (event.message || "Browser error") +
    ". Open the complete offline HTML in a browser with WebGL enabled. If you are editing the modular project, use npm run dev.";
  document.getElementById("stage").appendChild(panel);
});
