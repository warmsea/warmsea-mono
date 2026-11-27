import { h, nextTick, reactive, toRaw, type Component } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppBar, { type AppBarItem } from './AppBar.vue';
import meta, { Playground } from './AppBar.stories';

const items: readonly AppBarItem[] = [
  { id: 'activity', label: 'Activity', href: '#activity' },
  {
    id: 'chat',
    label: 'Chat',
    href: '#chat',
  },
];
const bottomItems = [{ id: 'settings', label: 'Settings', href: '#settings' }];

function mountAppBar(
  options: NonNullable<Parameters<typeof mount<typeof AppBar>>[1]>,
) {
  return mount(AppBar, { slots: { icon: () => h('svg') }, ...options });
}

describe('AppBar', () => {
  it('keeps Playground content synchronized with changed destination arguments', async () => {
    const args = reactive({ ...meta.args });
    const story = Playground.render!(args, {} as never);
    const wrapper = mount(story as Component);
    try {
      args.items = [{ id: 'coast', label: 'Coast', href: '#changed-coast' }];
      args.bottomItems = [
        { id: 'account', label: 'Account', href: '#changed-account' },
      ];
      await nextTick();
      expect(
        wrapper.findAll('a').map((link) => link.attributes('href')),
      ).toEqual(['#changed-coast', '#changed-account']);
      expect(wrapper.get('#changed-coast h2').text()).toBe('Coast');
      expect(wrapper.get('#changed-account h2').text()).toBe('Account');
      expect(wrapper.find('#appbar-demo-chat').exists()).toBe(false);
      args.bottomItems = [];
      await nextTick();
      expect(wrapper.find('#changed-account').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
  it('renders native navigation and ordered links without implicit selection', () => {
    const wrapper = mountAppBar({ props: { items } });
    expect(wrapper.element.tagName).toBe('NAV');
    expect(wrapper.findAll('ul')).toHaveLength(1);
    expect(
      wrapper.findAll('li a').map((link) => link.attributes('href')),
    ).toEqual(['#activity', '#chat']);
    expect(
      wrapper.findAll('a').map((link) => link.attributes('aria-label')),
    ).toEqual(['Activity', 'Chat']);
    expect(wrapper.find('[aria-current]').exists()).toBe(false);
    expect(wrapper.find('.wui-app-bar__indicator').exists()).toBe(false);
    expect(
      wrapper
        .find('[role="menu"], [role="tablist"], [tabindex], [aria-selected]')
        .exists(),
    ).toBe(false);
    expect(
      wrapper.findAll('.wui-app-bar__icon[aria-hidden="true"]'),
    ).toHaveLength(2);
    expect(wrapper.find('.wui-tooltip').attributes('title')).toBe('Activity');
    expect(wrapper.find('a').attributes('title')).toBeUndefined();
    expect(wrapper.findAll('a').every((link) => link.text() === '')).toBe(true);
  });

  it('omits empty groups and supports bottom-only and empty navigation', async () => {
    const wrapper = mountAppBar({ props: { items: [], bottomItems } });
    expect(wrapper.findAll('ul')).toHaveLength(1);
    expect(wrapper.find('ul').classes()).toContain(
      'wui-app-bar__group--bottom',
    );
    await wrapper.setProps({ bottomItems: [] });
    expect(wrapper.findAll('ul')).toHaveLength(0);
  });

  it('keeps bottom links after main links and updates current state across groups', async () => {
    const wrapper = mountAppBar({
      props: { items, bottomItems, activeId: 'chat' },
    });
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual(
      ['#activity', '#chat', '#settings'],
    );
    expect(wrapper.findAll('[aria-current="page"]')).toHaveLength(1);
    await nextTick();
    expect(
      wrapper.find('.wui-app-bar__indicator').attributes('aria-hidden'),
    ).toBe('true');
    expect(wrapper.find('[aria-current]').attributes('href')).toBe('#chat');
    await wrapper.setProps({ activeId: 'settings' });
    expect(wrapper.find('[aria-current]').attributes('href')).toBe('#settings');
    await wrapper.setProps({ activeId: 'unknown' });
    expect(wrapper.find('[aria-current]').exists()).toBe(false);
    expect(wrapper.find('.wui-app-bar__indicator').exists()).toBe(false);
    await wrapper.setProps({ items: [items[0]!] });
    expect(wrapper.findAll('a')).toHaveLength(2);
    expect(wrapper.emitted('activate')).toBeUndefined();
  });

  describe('layout observation', () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    let resize: () => void;
    let itemHeight: number;

    beforeEach(() => {
      observe.mockClear();
      unobserve.mockClear();
      disconnect.mockClear();
      itemHeight = 40;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe = observe;
          unobserve = unobserve;
          disconnect = disconnect;
          constructor(callback: ResizeObserverCallback) {
            resize = () => callback([], this);
          }
        },
      );
      vi.spyOn(
        HTMLElement.prototype,
        'getBoundingClientRect',
      ).mockImplementation(function (this: HTMLElement) {
        const links = Array.from(
          this.closest('nav')?.querySelectorAll('a') ?? [],
        );
        const index = links.indexOf(this as HTMLAnchorElement);
        return new DOMRect(
          0,
          index < 0 ? 0 : index * itemHeight,
          80,
          itemHeight,
        );
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('keeps subscriptions stable through selection, marker and content updates', async () => {
      const wrapper = mountAppBar({
        props: { items, bottomItems, activeId: 'chat' },
      });
      await nextTick();
      const targets = [
        wrapper.element,
        ...wrapper
          .findAll('.wui-app-bar__content, ul, a')
          .map((element) => element.element),
      ];
      expect(observe.mock.calls.map(([element]) => element)).toEqual(targets);
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 60px');
      await wrapper.setProps({ activeId: 'settings' });
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 100px');
      await wrapper.setProps({ activeId: 'unknown' });
      expect(wrapper.find('.wui-app-bar__indicator').exists()).toBe(false);
      await wrapper.setProps({ activeId: 'activity' });
      await wrapper.setProps({
        items: items.map((item) => ({ ...item, label: `${item.label}!` })),
      });
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 20px');
      expect(observe.mock.calls.map(([element]) => element)).toEqual(targets);
      expect(unobserve).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
      wrapper.unmount();
      expect(disconnect).toHaveBeenCalledOnce();
    });

    it('observes added links and groups and releases only removed elements', async () => {
      const wrapper = mountAppBar({ props: { items, activeId: 'chat' } });
      await nextTick();
      const group = wrapper.find('ul').element;
      const initialLinks = wrapper.findAll('a').map((link) => link.element);
      const calendar = { id: 'calendar', label: 'Calendar', href: '#calendar' };
      observe.mockClear();
      await wrapper.setProps({ items: [items[0]!, calendar, items[1]!] });
      const addedLink = wrapper.findAll('a')[1]!.element;
      expect(observe).toHaveBeenCalledExactlyOnceWith(addedLink);
      expect(unobserve).not.toHaveBeenCalled();
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 100px');
      observe.mockClear();
      await wrapper.setProps({ items });
      expect(observe).not.toHaveBeenCalled();
      expect(unobserve).toHaveBeenCalledExactlyOnceWith(addedLink);
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 60px');
      unobserve.mockClear();
      await wrapper.setProps({ bottomItems });
      const bottom = wrapper.findAll('ul')[1]!.element;
      const bottomLink = wrapper.findAll('a')[2]!.element;
      expect(observe.mock.calls.map(([element]) => element)).toEqual([
        bottom,
        bottomLink,
      ]);
      expect(unobserve).not.toHaveBeenCalled();
      observe.mockClear();
      await wrapper.setProps({ bottomItems: [] });
      expect(observe).not.toHaveBeenCalled();
      expect(unobserve.mock.calls.map(([element]) => element)).toEqual([
        bottom,
        bottomLink,
      ]);
      unobserve.mockClear();
      await wrapper.setProps({ items: [] });
      expect(unobserve.mock.calls.map(([element]) => element)).toEqual([
        group,
        ...initialLinks,
      ]);
      expect(wrapper.find('.wui-app-bar__indicator').exists()).toBe(false);
      await wrapper.setProps({ bottomItems, activeId: 'settings' });
      const newBottom = wrapper.find('ul').element;
      const newLink = wrapper.find('a').element;
      expect(observe.mock.calls.map(([element]) => element)).toEqual([
        newBottom,
        newLink,
      ]);
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 20px');
      expect(disconnect).not.toHaveBeenCalled();
      wrapper.unmount();
      expect(disconnect).toHaveBeenCalledOnce();
    });

    it('remeasures keyed item reordering without changing subscriptions', async () => {
      const help = { id: 'help', label: 'Help', href: '#help' };
      const wrapper = mountAppBar({
        props: {
          items,
          bottomItems: [...bottomItems, help],
          activeId: 'settings',
        },
      });
      await nextTick();
      const settings = wrapper.find('[href="#settings"]').element;
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 100px');
      observe.mockClear();
      await wrapper.setProps({
        items: [...items].reverse(),
        bottomItems: [help, ...bottomItems],
      });
      expect(wrapper.find('[href="#settings"]').element).toBe(settings);
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 140px');
      await wrapper.setProps({ activeId: 'chat' });
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 20px');
      expect(observe).not.toHaveBeenCalled();
      expect(unobserve).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
      wrapper.unmount();
      expect(disconnect).toHaveBeenCalledOnce();
    });

    it('updates measured geometry from resize callbacks without resubscribing', async () => {
      const wrapper = mountAppBar({
        props: { items, bottomItems, activeId: 'chat' },
      });
      await nextTick();
      observe.mockClear();
      itemHeight = 64;
      resize();
      await nextTick();
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 96px');
      await wrapper.setProps({ activeId: 'settings' });
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 160px');
      resize();
      await nextTick();
      expect(observe).not.toHaveBeenCalled();
      expect(unobserve).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
      wrapper.unmount();
      expect(disconnect).toHaveBeenCalledOnce();
    });

    it('still measures selection updates without ResizeObserver', async () => {
      vi.stubGlobal('ResizeObserver', undefined);
      const wrapper = mountAppBar({ props: { items, activeId: 'chat' } });
      await nextTick();
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 60px');
      await wrapper.setProps({ activeId: 'activity' });
      expect(
        wrapper.find('.wui-app-bar__indicator').attributes('style'),
      ).toContain('top: 20px');
      expect(observe).not.toHaveBeenCalled();
      wrapper.unmount();
    });
  });

  it('provides reactive item and active data to decorative icons in both groups', async () => {
    const wrapper = mountAppBar({
      props: { items, bottomItems, activeId: 'activity' },
      slots: {
        icon: ({ item, active }: { item: AppBarItem; active: boolean }) =>
          h('svg', { 'data-item': item.id, 'data-active': String(active) }),
      },
    });
    expect(
      wrapper.findAll('.wui-app-bar__icon[aria-hidden="true"]'),
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-item="activity"]').attributes('data-active'),
    ).toBe('true');
    expect(wrapper.find('[data-item="settings"]').exists()).toBe(true);
    expect(wrapper.find('a').attributes('aria-label')).toBe('Activity');
    await wrapper.setProps({ activeId: 'settings' });
    expect(
      wrapper.find('[data-item="settings"]').attributes('data-active'),
    ).toBe('true');
    expect(
      wrapper.find('[data-item="activity"]').attributes('data-active'),
    ).toBe('false');
  });

  it('updates accessible labels and tooltip text without displaying text inside links', async () => {
    const wrapper = mountAppBar({ props: { items } });
    const chat = wrapper.findAll('a')[1]!;
    expect(chat.attributes('aria-label')).toBe('Chat');
    expect(wrapper.findAll('[role="tooltip"]')[1]!.text()).toBe('Chat');
    expect(chat.attributes('aria-describedby')).toBeUndefined();
    expect(chat.text()).toBe('');
    expect(wrapper.find('[aria-live], button').exists()).toBe(false);
    await wrapper.setProps({
      items: [{ ...items[1]!, label: 'Chat and collaboration' }],
    });
    expect(wrapper.find('a').attributes('aria-label')).toBe(
      'Chat and collaboration',
    );
    expect(wrapper.find('[role="tooltip"]').text()).toBe(
      'Chat and collaboration',
    );
    expect(wrapper.find('a').text()).toBe('');
  });

  it('forwards native root attributes and bubbling events without changing selection', async () => {
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    const wrapper = mountAppBar({
      props: { items },
      attrs: {
        id: 'primary',
        'aria-label': 'Primary',
        'data-purpose': 'navigation',
        class: 'consumer',
        style: { height: '300px' },
        onClick,
      },
    });
    expect(wrapper.attributes()).toMatchObject({
      id: 'primary',
      'aria-label': 'Primary',
      'data-purpose': 'navigation',
    });
    expect(wrapper.classes()).toContain('consumer');
    expect(wrapper.element.style.height).toBe('300px');
    await wrapper.find('a').trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0]).toBeInstanceOf(MouseEvent);
    expect(wrapper.find('[aria-current]').exists()).toBe(false);
    expect(wrapper.emitted('update:activeId')).toBeUndefined();
  });

  it('emits the rendered item and original click once in either group without selecting or canceling', async () => {
    const onActivate = vi.fn();
    const onClick = vi.fn();
    const wrapper = mountAppBar({
      props: { items, bottomItems, onActivate },
      attrs: { onClick },
      slots: { icon: () => h('svg', [h('path')]) },
    });
    // Native clicks arrive after the task that registers Vue's listeners.
    await new Promise((resolve) => setTimeout(resolve, 1));
    const links = wrapper.findAll('a');
    for (const [index, item] of [...items, ...bottomItems].entries()) {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const target = links[index]!.find('path').element;
      expect(target.dispatchEvent(event)).toBe(true);
      expect(onActivate).toHaveBeenNthCalledWith(index + 1, item, event);
      expect(toRaw(onActivate.mock.calls[index]?.[0])).toBe(item);
      expect(onActivate.mock.calls[index]?.[1]).toBe(event);
      expect(onClick).toHaveBeenNthCalledWith(index + 1, event);
      expect(event.defaultPrevented).toBe(false);
      expect(event.target).toBe(target);
    }
    await nextTick();
    expect(wrapper.emitted('activate')).toHaveLength(3);
    expect(wrapper.find('[aria-current]').exists()).toBe(false);
    expect(wrapper.emitted('update:activeId')).toBeUndefined();
    await wrapper.find('ul').trigger('click');
    expect(onActivate).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });

  it('lets activation handlers cancel native navigation without stopping root click listeners', async () => {
    let currentTarget: EventTarget | null = null;
    const onActivate = vi.fn((_item: AppBarItem, event: MouseEvent) => {
      currentTarget = event.currentTarget;
      event.preventDefault();
    });
    const onClick = vi.fn();
    const wrapper = mountAppBar({
      props: { items, activeId: 'activity', onActivate },
      attrs: { onClick },
    });
    await new Promise((resolve) => setTimeout(resolve, 1));
    const link = wrapper.findAll('a')[1]!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(link.element.dispatchEvent(event)).toBe(false);
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(items[1], event);
    expect(currentTarget).toBe(link.element);
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).toHaveBeenCalledExactlyOnceWith(event);
    expect(wrapper.find('[aria-current]').attributes('href')).toBe('#activity');
    wrapper.unmount();
  });

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { detail: 0 },
  ])(
    'preserves modified and keyboard-generated click events: %j',
    (options) => {
      const onActivate = vi.fn();
      const wrapper = mountAppBar({ props: { items, onActivate } });
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ...options,
      });
      expect(wrapper.find('a').element.dispatchEvent(event)).toBe(true);
      expect(onActivate).toHaveBeenCalledExactlyOnceWith(items[0], event);
      expect(event.defaultPrevented).toBe(false);
      wrapper.unmount();
    },
  );

  it('does not emit activation for auxiliary clicks or context menus', async () => {
    const onActivate = vi.fn();
    const wrapper = mountAppBar({ props: { items, onActivate } });
    await wrapper.find('a').trigger('auxclick', { button: 1 });
    await wrapper.find('a').trigger('contextmenu', { button: 2 });
    expect(onActivate).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
