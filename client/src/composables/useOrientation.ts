import { onMounted, onUnmounted, ref } from "vue";

/** Téléphone tenu en portrait (écran étroit et plus haut que large). */
export function usePortraitPhone() {
  const portrait = ref(false);
  let query: MediaQueryList | undefined;
  const update = () => (portrait.value = !!query?.matches);
  onMounted(() => {
    query = window.matchMedia("(orientation: portrait) and (max-width: 900px)");
    update();
    query.addEventListener("change", update);
  });
  onUnmounted(() => query?.removeEventListener("change", update));
  return portrait;
}
