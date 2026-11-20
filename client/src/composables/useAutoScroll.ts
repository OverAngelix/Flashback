import { onMounted, onUnmounted, type Ref } from "vue";
import { AUTO_SCROLL, autoScrollStart, stepAutoScroll } from "@/autoScroll";

/** Après un défilement à la main, on laisse la liste tranquille ce temps-là avant de reprendre. */
const MANUAL_PAUSE_MS = 6000;

/**
 * Fait défiler `el` tout seul quand son contenu dépasse (voir `stepAutoScroll`). Un défilement à la
 * main (molette, doigt) met en pause, puis le mouvement reprend de là où on s'est arrêté.
 */
export function useAutoScroll(el: Ref<HTMLElement | null | undefined>) {
  let state = autoScrollStart();
  let last = 0;
  let pausedUntil = 0;
  let frame = 0;
  /** Après une pause manuelle, repartir de la position où on l'a laissée. */
  let resync = false;

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    const box = el.value;
    if (!box || now < pausedUntil) return;
    if (resync) {
      resync = false;
      state = { phase: "down", pos: box.scrollTop, wait: 0 };
    }
    state = stepAutoScroll(state, dt, box.scrollHeight - box.clientHeight, AUTO_SCROLL);
    // scrollTop est arrondi par le navigateur : on garde la position exacte dans `state`.
    if (Math.abs(box.scrollTop - state.pos) >= 1) box.scrollTop = state.pos;
  }

  function onManual() {
    pausedUntil = performance.now() + MANUAL_PAUSE_MS;
    resync = true;
  }

  onMounted(() => {
    frame = requestAnimationFrame(tick);
    for (const type of ["wheel", "touchstart", "pointerdown"] as const) el.value?.addEventListener(type, onManual, { passive: true });
  });
  onUnmounted(() => cancelAnimationFrame(frame));
}
