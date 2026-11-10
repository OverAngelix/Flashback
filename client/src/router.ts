import { createRouter, createWebHistory } from "vue-router";
import HomeView from "@/views/HomeView.vue";
import HostView from "@/views/HostView.vue";
import PlayView from "@/views/PlayView.vue";
import SettingsView from "@/views/SettingsView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/host", component: HostView },
    { path: "/play", component: PlayView },
    { path: "/settings", component: SettingsView },
    // Lien direct vers une salle : /join/ABC234 pré-remplit le code.
    { path: "/join/:code", component: PlayView, props: true },
    { path: "/:rest(.*)*", redirect: "/" },
  ],
});
