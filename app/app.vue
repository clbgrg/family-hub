<script setup lang="ts">
import GlobalAppLoading from "~/components/global/globalAppLoading.vue";
import GlobalDock from "~/components/global/globalDock.vue";
import GlobalScreensaver from "~/components/global/globalScreensaver.vue";
import GlobalSideBar from "~/components/global/globalSideBar.vue";

const dock = false;
const { isLoading, loadingMessage, setLoading } = useGlobalLoading();

setLoading(true);

onNuxtReady(() => {
  setLoading(false);
});
</script>

<template>
  <UApp>
    <GlobalAppLoading
      :is-loading="isLoading"
      :loading-message="loadingMessage || ''"
    />

    <div v-if="!dock" class="flex min-h-screen">
      <GlobalSideBar />
      <!-- min-w-0 lets the content area stay within the viewport so inner
           horizontal scrollers (e.g. the todo columns) actually scroll
           instead of pushing content off-screen. -->
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex-1 min-w-0">
          <NuxtPage />
        </div>
      </div>
    </div>
    <div v-else class="flex min-h-screen">
      <div class="flex flex-col flex-1">
        <div class="flex-1">
          <NuxtPage />
        </div>
        <GlobalDock />
      </div>
    </div>

    <ClientOnly>
      <GlobalScreensaver />
    </ClientOnly>
  </UApp>
</template>

<style>
/* Hide scrollbars globally */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

*::-webkit-scrollbar {
  display: none;
}
</style>
