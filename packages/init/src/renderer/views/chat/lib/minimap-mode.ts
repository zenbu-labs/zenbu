export const isMinimapMode = new URLSearchParams(window.location.search).has("minimap")

if (isMinimapMode) {
  document.documentElement.classList.add("minimap")
}
