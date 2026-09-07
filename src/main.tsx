import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Un despliegue nuevo invalida los chunks del que el navegador tiene abierto,
 * así que la siguiente navegación perezosa pide un fichero que ya no existe y
 * `React.lazy` revienta con una pantalla en blanco. Se vio en el piloto: un
 * error transitorio de módulo importado dinámicamente, que se arregla
 * recargando y que nadie sabe que se arregla recargando.
 *
 * Vite emite `vite:preloadError` justo en ese caso. Se recarga UNA vez —el
 * `sessionStorage` corta el bucle si el fallo no era por versión— y así el
 * usuario ve la aplicación en lugar de la nada.
 */
const CLAVE_RECARGA = "aims:recarga-por-chunk-obsoleto";

window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem(CLAVE_RECARGA)) return;
  event.preventDefault();
  sessionStorage.setItem(CLAVE_RECARGA, "1");
  window.location.reload();
});

// Una carga que llega hasta aquí ha ido bien: se limpia la marca para que la
// próxima vez el reintento vuelva a estar disponible.
window.addEventListener("load", () => sessionStorage.removeItem(CLAVE_RECARGA));

createRoot(document.getElementById("root")!).render(<App />);
