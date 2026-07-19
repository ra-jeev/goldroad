<script setup lang="ts">
const requestUrl = useRequestURL();
const route = useRoute();

const canonicalUrl = computed(() =>
  new URL(route.path || '/', requestUrl.origin).toString(),
);
const shareImageUrl = computed(() =>
  new URL('/icons/og-1200x630.png', requestUrl.origin).toString(),
);
const isProductionHost = computed(() =>
  ['playgoldroad.com', 'www.playgoldroad.com'].includes(requestUrl.hostname),
);

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
}));

useSeoMeta({
  ogUrl: canonicalUrl,
  ogImage: shareImageUrl,
  twitterImage: shareImageUrl,
  robots: computed(() =>
    isProductionHost.value ? 'index, follow' : 'noindex, nofollow',
  ),
});
</script>

<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>
