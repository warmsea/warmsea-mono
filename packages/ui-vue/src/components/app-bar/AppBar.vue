<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  type VNode,
} from 'vue';
import Tooltip from '../tooltip/Tooltip.vue';

export interface AppBarItem {
  id: string;
  label: string;
  href: string;
}

export interface AppBarProps {
  items: readonly AppBarItem[];
  bottomItems?: readonly AppBarItem[];
  activeId?: string;
}

const props = withDefaults(defineProps<AppBarProps>(), {
  bottomItems: () => [],
  activeId: undefined,
});

const emit = defineEmits<{
  activate: [item: AppBarItem, event: MouseEvent];
}>();

defineSlots<{
  icon: (props: { item: AppBarItem; active: boolean }) => VNode[];
}>();

const groups = computed(() => [props.items, props.bottomItems]);
const root = ref<HTMLElement>();
const indicatorTop = ref<number>();
const observedElements = new Set<Element>();
let resizeObserver: ResizeObserver | undefined;

function updateIndicator() {
  const nav = root.value;
  const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
  const rect = current?.getBoundingClientRect();
  const top =
    nav && rect
      ? rect.top -
        nav.getBoundingClientRect().top -
        nav.clientTop +
        nav.scrollTop +
        rect.height / 2
      : undefined;
  if (top !== indicatorTop.value) indicatorTop.value = top;
}

function observeLayout() {
  if (resizeObserver && root.value) {
    const elements = new Set<Element>([
      root.value,
      ...root.value.querySelectorAll(
        '.wui-app-bar__content, .wui-app-bar__group, .wui-app-bar__link',
      ),
    ]);
    for (const element of observedElements) {
      if (!elements.has(element)) {
        resizeObserver.unobserve(element);
        observedElements.delete(element);
      }
    }
    for (const element of elements) {
      if (!observedElements.has(element)) {
        resizeObserver.observe(element);
        observedElements.add(element);
      }
    }
  }
  updateIndicator();
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateIndicator);
  }
  observeLayout();
});
onUpdated(observeLayout);
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  observedElements.clear();
});
</script>

<template>
  <nav ref="root" class="wui-app-bar">
    <span
      v-if="indicatorTop !== undefined"
      class="wui-app-bar__indicator"
      :style="{ top: `${indicatorTop}px` }"
      aria-hidden="true"
    />
    <div class="wui-app-bar__content">
      <template v-for="(group, index) in groups" :key="index">
        <ul
          v-if="group.length"
          class="wui-app-bar__group"
          :class="{ 'wui-app-bar__group--bottom': index === 1 }"
        >
          <li v-for="item in group" :key="item.id" class="wui-app-bar__item">
            <Tooltip
              :text="item.label"
              placement="inline-end"
              :describe="false"
              class="wui-app-bar__tooltip"
            >
              <a
                class="wui-app-bar__link"
                :href="item.href"
                :aria-current="item.id === activeId ? 'page' : undefined"
                :aria-label="item.label"
                @click="emit('activate', item, $event)"
              >
                <span class="wui-app-bar__icon" aria-hidden="true">
                  <slot
                    name="icon"
                    :item="item"
                    :active="item.id === activeId"
                  />
                </span>
              </a>
            </Tooltip>
          </li>
        </ul>
      </template>
    </div>
  </nav>
</template>

<style>
.wui-app-bar {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: none;
  inline-size: 3rem;
  max-inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  padding-block: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  color: color-mix(
    in srgb,
    var(--wui-color-text) 72%,
    var(--wui-color-surface)
  );
  background: var(--wui-color-surface);
  border-inline-end: var(--wui-border-width) solid
    color-mix(in srgb, var(--wui-color-border) 25%, var(--wui-color-surface));
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size);
  font-weight: var(--wui-font-weight-regular);
  line-height: var(--wui-line-height);
}

.wui-app-bar__content {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  gap: var(--wui-space-4);
}

.wui-app-bar__group {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--wui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.wui-app-bar__group--bottom {
  margin-block-start: auto;
}

.wui-app-bar__item {
  min-inline-size: 0;
}

.wui-app-bar__tooltip {
  display: block;
}

.wui-app-bar__link {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-block-size: 2.75rem;
  padding: var(--wui-space-1);
  color: inherit;
  text-decoration: none;
  transition:
    color 80ms ease,
    background-color 80ms ease;
}

.wui-app-bar__link[aria-current='page'] {
  color: var(--wui-color-primary);
  font-weight: var(--wui-font-weight-semibold);
}

.wui-app-bar__indicator {
  position: absolute;
  z-index: 1;
  inset-inline-start: 0;
  block-size: 1.25rem;
  border-inline-start: calc(var(--wui-border-width) + var(--wui-focus-width))
    solid var(--wui-color-primary);
  border-radius: var(--wui-space-1);
  transform: translateY(-50%);
  pointer-events: none;
  transition: top 200ms cubic-bezier(0.33, 1.33, 0.67, 1);
}

.wui-app-bar__link:hover {
  color: var(--wui-color-text);
  background: var(--wui-color-surface-hover);
}

.wui-app-bar__link:active {
  background: var(--wui-color-surface-active);
}

.wui-app-bar__link[aria-current='page']:hover {
  color: var(--wui-color-primary);
}

.wui-app-bar__link:focus-visible {
  outline: var(--wui-focus-width) solid var(--wui-color-focus);
  outline-offset: calc(-1 * var(--wui-focus-width));
}

.wui-app-bar__icon {
  display: inline-flex;
  flex: none;
  inline-size: 1.25rem;
  block-size: 1.25rem;
}

.wui-app-bar__icon > * {
  inline-size: 100%;
  block-size: 100%;
}

@media (forced-colors: active) {
  .wui-app-bar {
    border-color: CanvasText;
  }

  .wui-app-bar__indicator {
    border-inline-start-color: Highlight;
  }

  .wui-app-bar__link:focus-visible {
    outline-color: LinkText;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wui-app-bar__indicator,
  .wui-app-bar__link {
    transition: none;
  }
}
</style>
