import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref, onMounted, onUnmounted } from 'vue';
import { AppBar, type AppBarItem } from '../../src';
import './contract.css';

export default {
  title: 'Contracts/AppBar',
  id: 'wui-contract-app-bar',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export const Navigation: StoryObj = {
  render: () => ({
    components: { AppBar },
    setup() {
      const appIconPaths: Record<string, string> = {
        activity: 'M6 10a6 6 0 0 1 12 0v5l2 2H4l2-2v-5Zm3 10h6',
        chat: 'M4 4h16v12H9l-5 4V4Z',
        calendar: 'M4 5h16v15H4V5Zm0 5h16M8 2v6m8-6v6',
        settings:
          'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
      };
      const appItems: readonly AppBarItem[] = [
        { id: 'activity', label: 'Activity', href: '#app-activity' },
        {
          id: 'chat',
          label: 'Chat',
          href: '#app-chat',
        },
        { id: 'calendar', label: 'Calendar', href: '#app-calendar' },
      ];
      const appBottomItems = [
        { id: 'settings', label: 'Settings', href: '#app-settings' },
      ];
      const appDestinations = [...appItems, ...appBottomItems];
      const activeApp = ref<string>();
      function syncAppLocation() {
        activeApp.value = appDestinations.find(
          (item) => item.href === window.location.hash,
        )?.id;
      }
      onMounted(() => {
        syncAppLocation();
        window.addEventListener('hashchange', syncAppLocation);
      });
      onUnmounted(() =>
        window.removeEventListener('hashchange', syncAppLocation),
      );
      const overflowItems = [
        {
          id: 'long',
          label: 'Internationalcollaborationworkspace',
          href: '#app-chat',
        },
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `app-${index}`,
          label: `App ${index + 1}`,
          href: '#app-activity',
        })),
      ];

      return {
        appIconPaths,
        appItems,
        appBottomItems,
        appDestinations,
        activeApp,
        overflowItems,
      };
    },
    template: `<main class="wui-contract"><h1>AppBar contracts</h1>
    <section id="app-bar-examples" aria-labelledby="app-bar-title">
      <h2 id="app-bar-title">App navigation</h2>
      <p>
        Native links change the fragment. This example owns the current item;
        AppBar never selects a destination by itself.
      </p>
      <div id="app-bar-shell" class="app-bar-shell">
        <AppBar
          aria-label="Primary apps"
          :items="appItems"
          :bottom-items="appBottomItems"
          :active-id="activeApp"
        >
          <template #icon="{ item, active }">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              :stroke-width="active ? 2 : 1.75"
              focusable="false"
            >
              <path :d="appIconPaths[item.id] ?? appIconPaths.activity" />
            </svg>
          </template>
        </AppBar>
        <div
          class="app-bar-content"
          role="region"
          aria-label="App content"
          tabindex="0"
        >
          <div
            v-for="item in appDestinations"
            :id="item.href.slice(1)"
            :key="item.id"
          >
            <h3>{{ item.label }}</h3>
            <p>{{ item.label }} destination</p>
          </div>
        </div>
      </div>
      <div class="row app-bar-comparisons">
        <div class="app-bar-short">
          <AppBar
            aria-label="Overflow apps"
            :items="overflowItems"
            :bottom-items="appBottomItems"
            active-id="long"
          >
            <template #icon="{ item, active }">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                :stroke-width="active ? 2 : 1.75"
                focusable="false"
              >
                <path :d="appIconPaths[item.id] ?? appIconPaths.activity" />
              </svg>
            </template>
          </AppBar>
        </div>
        <div class="app-bar-scoped" data-testid="app-bar-outer">
          <AppBar
            aria-label="Outer brand apps"
            :items="appItems"
            active-id="chat"
          >
            <template #icon="{ item, active }">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                :stroke-width="active ? 2 : 1.75"
                focusable="false"
              >
                <path :d="appIconPaths[item.id] ?? appIconPaths.activity" />
              </svg>
            </template>
          </AppBar>
          <div class="app-bar-inner" data-testid="app-bar-inner">
            <AppBar
              aria-label="Inner brand apps"
              :items="appItems"
              active-id="chat"
            >
              <template #icon="{ item, active }">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  :stroke-width="active ? 2 : 1.75"
                  focusable="false"
                >
                  <path :d="appIconPaths[item.id] ?? appIconPaths.activity" />
                </svg>
              </template>
            </AppBar>
          </div>
        </div>
        <div class="app-bar-rtl" dir="rtl">
          <AppBar aria-label="RTL apps" :items="appItems" active-id="activity">
            <template #icon="{ item, active }">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                :stroke-width="active ? 2 : 1.75"
                focusable="false"
              >
                <path :d="appIconPaths[item.id] ?? appIconPaths.activity" />
              </svg>
            </template>
          </AppBar>
        </div>
      </div>
    </section>

    </main>`,
  }),
};
