import { h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Tooltip, { type TooltipProps } from './Tooltip.vue';
import AppBar from '../app-bar/AppBar.vue';

const originalShow = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'showPopover',
);
const originalHide = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'hidePopover',
);
const nativeMatches = Element.prototype.matches;
const wrappers: { unmount(): void }[] = [];
let popovers: WeakSet<Element>;
let targetRect: DOMRect;
let surfaceRect: DOMRect;
let intersect: IntersectionObserverCallback;
let autoIntersect: boolean;
const disconnect = vi.fn();
const observe = vi.fn();
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function render(
  props: Partial<TooltipProps> = {},
  attrs: Record<string, unknown> = {},
) {
  const wrapper = mount(Tooltip, {
    attachTo: document.body,
    props: { text: 'Helpful text', ...props },
    attrs,
    slots: {
      default: ({ describedBy }: { describedBy: string | undefined }) =>
        h('button', { 'aria-describedby': describedBy }, 'Trigger'),
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  popovers = new WeakSet();
  targetRect = new DOMRect(200, 200, 80, 40);
  surfaceRect = new DOMRect(0, 0, 120, 32);
  frames = new Map();
  nextFrame = 0;
  autoIntersect = true;
  disconnect.mockClear();
  observe.mockClear();
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: {
      configurable: true,
      value(this: HTMLElement) {
        popovers.add(this);
      },
    },
    hidePopover: {
      configurable: true,
      value(this: HTMLElement) {
        popovers.delete(this);
      },
    },
  });
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector,
  ) {
    if (selector === ':popover-open') return popovers.has(this);
    if (selector === ':focus-visible') return this === document.activeElement;
    return nativeMatches.call(this, selector);
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains('wui-tooltip__content')
        ? surfaceRect
        : targetRect;
    },
  );
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    600,
  );
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(element: Element) {
        observe(element);
        if (autoIntersect)
          intersect(
            [
              { target: element, isIntersecting: true },
            ] as IntersectionObserverEntry[],
            this as unknown as IntersectionObserver,
          );
      }
      disconnect = disconnect;
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
    },
  );
});

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  if (originalShow)
    Object.defineProperty(HTMLElement.prototype, 'showPopover', originalShow);
  else Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  if (originalHide)
    Object.defineProperty(HTMLElement.prototype, 'hidePopover', originalHide);
  else Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Tooltip', () => {
  it('provides a stable description target without focus stops, live regions or initial work', async () => {
    const wrapper = render();
    const surface = wrapper.find('[role="tooltip"]');
    expect(wrapper.element.tagName).toBe('SPAN');
    expect(wrapper.find('button').attributes('aria-describedby')).toBe(
      surface.attributes('id'),
    );
    expect(surface.text()).toBe('Helpful text');
    expect(surface.attributes('popover')).toBe('manual');
    expect(wrapper.find('[tabindex], [aria-live], [autofocus]').exists()).toBe(
      false,
    );
    expect(frames.size).toBe(0);
    expect(observe).not.toHaveBeenCalled();
    const id = surface.attributes('id');
    await wrapper.setProps({ text: 'Updated help', describe: false });
    expect(surface.attributes('id')).toBe(id);
    expect(
      wrapper.find('button').attributes('aria-describedby'),
    ).toBeUndefined();
    await wrapper.setProps({ describe: true });
    expect(wrapper.find('button').attributes('aria-describedby')).toBe(id);
  });

  it('generates distinct IDs within one Vue application', () => {
    const wrapper = mount({
      render: () =>
        h('div', [
          h(Tooltip, { text: 'One' }, () => h('button', 'One')),
          h(Tooltip, { text: 'Two' }, () => h('button', 'Two')),
        ]),
    });
    wrappers.push(wrapper);
    const ids = wrapper
      .findAll('[role="tooltip"]')
      .map((surface) => surface.attributes('id'));
    expect(new Set(ids).size).toBe(2);
  });

  it('opens immediately, measures top placement, and releases all work when hover ends', async () => {
    const wrapper = render();
    await nextTick();
    expect(wrapper.attributes('title')).toBeUndefined();
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    const surface = wrapper.find<HTMLElement>('[role="tooltip"]');
    expect(popovers.has(surface.element)).toBe(true);
    expect(surface.attributes('data-side')).toBe('top');
    expect(surface.element.style.left).toBe('180px');
    expect(surface.element.style.top).toBe('160px');
    expect(frames.size).toBe(1);
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      wrapper.find('button').element,
    );
    await wrapper.trigger('pointerleave');
    expect(popovers.has(surface.element)).toBe(false);
    expect(frames.size).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('keeps combined keyboard focus and hover until both end', async () => {
    const wrapper = render();
    wrapper.find('button').element.focus();
    await nextTick();
    const surface = wrapper.find('[role="tooltip"]').element;
    expect(popovers.has(surface)).toBe(true);
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    await wrapper.trigger('pointerleave');
    expect(popovers.has(surface)).toBe(true);
    wrapper.find('button').element.blur();
    await nextTick();
    expect(popovers.has(surface)).toBe(false);
  });

  it('waits for native keyboard-focus scrolling without polling or losing the opening intent', async () => {
    autoIntersect = false;
    targetRect = new DOMRect(200, 900, 80, 40);
    const wrapper = render();
    const button = wrapper.find('button');
    button.element.focus();
    await nextTick();
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(false);
    expect(frames.size).toBe(0);
    targetRect = new DOMRect(200, 200, 80, 40);
    intersect(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(true);
    expect(document.activeElement).toBe(button.element);
  });

  it('cancels pending focus visibility observation on Escape and ignores stale callbacks', async () => {
    autoIntersect = false;
    const wrapper = render();
    wrapper.find('button').element.focus();
    await nextTick();
    await wrapper.find('button').trigger('keydown', { key: 'Escape' });
    intersect(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(false);
    expect(frames.size).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('dismisses on Escape without consuming it or moving focus, and does not immediately reopen', async () => {
    const onKeydown = vi.fn();
    const wrapper = render({}, { onKeydown });
    const button = wrapper.find('button');
    button.element.focus();
    await nextTick();
    await button.trigger('keydown', { key: 'Escape' });
    const surface = wrapper.find('[role="tooltip"]').element;
    expect(popovers.has(surface)).toBe(false);
    expect(document.activeElement).toBe(button.element);
    expect(onKeydown).toHaveBeenCalledOnce();
    expect(onKeydown.mock.calls[0]?.[0].defaultPrevented).toBe(false);
    await wrapper.setProps({ text: 'Changed while dismissed' });
    expect(popovers.has(surface)).toBe(false);
    button.element.blur();
    await nextTick();
    button.element.focus();
    await nextTick();
    expect(popovers.has(surface)).toBe(true);
  });

  it('does not turn touch pointer entry or pointer-generated focus into an opening action', async () => {
    const wrapper = render();
    await wrapper.trigger('pointerenter', { pointerType: 'touch' });
    await wrapper.trigger('pointerdown', { pointerType: 'touch' });
    wrapper.find('button').element.focus();
    await nextTick();
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(false);
    await wrapper.trigger('pointerleave');
    await wrapper.trigger('keydown', { key: 'ArrowRight' });
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(true);
  });

  it.each(['open', 'dismissed', 'pending'])(
    'ends the %s interaction on keyed replacement and ignores old observation/frame callbacks',
    async (state) => {
      autoIntersect = state !== 'pending';
      const key = ref(0);
      const wrapper = mount(
        {
          render: () =>
            h(Tooltip, { text: 'Help' }, () =>
              h('button', { key: key.value }, 'Trigger'),
            ),
        },
        { attachTo: document.body },
      );
      wrappers.push(wrapper);
      wrapper.find('button').element.focus();
      await nextTick();
      const surface = wrapper.find('[role="tooltip"]').element;
      const staleIntersection = intersect;
      const staleFrame = [...frames.values()][0];
      if (state === 'dismissed') {
        await wrapper.find('button').trigger('keydown', { key: 'Escape' });
        await wrapper.find('button').trigger('keydown', { key: 'ArrowRight' });
        await wrapper.find('button').trigger('focusin');
        expect(popovers.has(surface)).toBe(false);
      }
      key.value++;
      await nextTick();
      expect(popovers.has(surface)).toBe(false);
      expect(frames.size).toBe(0);
      expect(disconnect).toHaveBeenCalledOnce();
      wrapper.find('button').element.focus();
      await nextTick();
      const replacementIntersection = intersect;
      staleIntersection(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
      if (state === 'pending') expect(popovers.has(surface)).toBe(false);
      replacementIntersection(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
      staleFrame?.(0);
      expect(popovers.has(surface)).toBe(true);
      expect(frames.size).toBe(1);
      wrapper.find('button').element.blur();
      await nextTick();
      expect(frames.size).toBe(0);
    },
  );

  it.each([false, true])(
    'recognizes replacement focus before tracking or a Vue update (Escape dismissed: %s)',
    async (dismissed) => {
      const wrapper = render();
      const original = wrapper.find('button').element;
      original.focus();
      await nextTick();
      if (dismissed) {
        await wrapper.find('button').trigger('keydown', { key: 'Escape' });
      }
      const replacement = document.createElement('button');
      original.replaceWith(replacement);
      replacement.focus();
      await nextTick();
      expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(true);
      expect(observe).toHaveBeenLastCalledWith(replacement);
      expect(frames.size).toBe(1);
      replacement.blur();
      await nextTick();
      expect(frames.size).toBe(0);
    },
  );

  it('preserves native click bubbling, cancellation, and wrapper attribute fallthrough', async () => {
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    const wrapper = render({}, { class: 'consumer', id: 'help', onClick });
    expect(wrapper.attributes('id')).toBe('help');
    expect(wrapper.classes()).toContain('consumer');
    await wrapper.find('button').trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(true);
  });

  it('handles opposite-side collisions, RTL, content changes and frame-based layout shifts', async () => {
    const wrapper = render();
    targetRect = new DOMRect(200, 0, 80, 40);
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    const surface = wrapper.find<HTMLElement>('[role="tooltip"]');
    expect(surface.attributes('data-side')).toBe('bottom');
    await wrapper.setProps({ placement: 'inline-end' });
    wrapper.find('button').element.style.direction = 'rtl';
    targetRect = new DOMRect(300, 200, 80, 40);
    surfaceRect = new DOMRect(0, 0, 160, 48);
    const callback = [...frames.values()][0]!;
    frames.clear();
    callback(0);
    expect(surface.attributes('data-side')).toBe('left');
    expect(surface.element.style.left).toBe('132px');
    expect(surface.element.style.top).toBe('196px');
    expect(frames.size).toBe(1);
  });

  it('keeps oversized or empty content closed without dangling associations or clipping', async () => {
    const wrapper = render({ text: ' ' });
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    expect(
      wrapper.find('button').attributes('aria-describedby'),
    ).toBeUndefined();
    expect(frames.size).toBe(0);
    await wrapper.setProps({ text: 'Help' });
    await nextTick();
    expect(frames.size).toBe(1);
    await wrapper.setProps({ text: '' });
    expect(frames.size).toBe(0);
    surfaceRect = new DOMRect(0, 0, 900, 900);
    await wrapper.setProps({ text: 'Too large' });
    await nextTick();
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('closes when the trigger is clipped, externally dismissed, or unmounted', async () => {
    const wrapper = render();
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    intersect(
      [{ isIntersecting: false }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(frames.size).toBe(0);
    await wrapper.trigger('pointerleave');
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    const surface = wrapper.find<HTMLElement>('[role="tooltip"]');
    popovers.delete(surface.element);
    await surface.trigger('toggle');
    expect(frames.size).toBe(0);
    await wrapper.trigger('pointerleave');
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    wrapper.unmount();
    wrappers.pop();
    expect(frames.size).toBe(0);
    expect(popovers.has(surface.element)).toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(3);
  });

  it.each(['hidden', 'removed'])(
    'closes and releases tracking when the trigger is %s',
    async (state) => {
      const wrapper = render();
      await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
      const button = wrapper.find('button').element;
      if (state === 'hidden') button.style.visibility = 'hidden';
      else button.remove();
      const callback = [...frames.values()][0]!;
      frames.clear();
      callback(0);
      expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(
        false,
      );
      expect(frames.size).toBe(0);
      expect(disconnect).toHaveBeenCalledOnce();
    },
  );

  it('provides an explicitly hidden description and native title when popovers are unsupported', async () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
    Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
    const wrapper = render();
    await nextTick();
    expect(wrapper.attributes('title')).toBe('Helpful text');
    expect(wrapper.find('[role="tooltip"]').attributes('hidden')).toBeDefined();
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' });
    wrapper.find('button').element.focus();
    await nextTick();
    expect(frames.size).toBe(0);
    expect(observe).not.toHaveBeenCalled();
    expect(wrapper.find('button').attributes('aria-describedby')).toBeTruthy();
  });

  it('enhances AppBar links without redundant names, titles, event cancellation or focus changes', async () => {
    const onActivate = vi.fn();
    const onClick = vi.fn();
    const wrapper = mount(AppBar, {
      attachTo: document.body,
      props: {
        items: [{ id: 'chat', label: 'Chat', href: '#chat' }],
        onActivate,
      },
      attrs: { onClick },
      slots: { icon: () => h('svg') },
    });
    wrappers.push(wrapper);
    await nextTick();
    const link = wrapper.find('a');
    expect(wrapper.find('[title]').exists()).toBe(false);
    expect(link.attributes('aria-label')).toBe('Chat');
    expect(link.attributes('aria-describedby')).toBeUndefined();
    expect(link.text()).toBe('');
    link.element.focus();
    await nextTick();
    expect(popovers.has(wrapper.find('[role="tooltip"]').element)).toBe(true);
    expect(document.activeElement).toBe(link.element);
    await link.trigger('click');
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
    expect(onActivate.mock.calls[0]?.[1].defaultPrevented).toBe(false);
  });
});
