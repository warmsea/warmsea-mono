import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import Text from './Text.vue';

describe('Text', () => {
  it('defaults to a native regular paragraph with slot markup', () => {
    const wrapper = mount(Text, {
      slots: { default: 'Explore <strong>Warmsea</strong>' },
    });
    expect(wrapper.element.tagName).toBe('P');
    expect(wrapper.classes()).toEqual(['wui-text', 'wui-text--regular']);
    expect(wrapper.find('strong').text()).toBe('Warmsea');
    for (const attr of ['as', 'size', 'weight', 'role', 'tabindex']) {
      expect(wrapper.attributes(attr)).toBeUndefined();
    }
  });

  it.each(['p', 'span'] as const)('renders a native %s', (as) => {
    expect(mount(Text, { props: { as } }).element.tagName).toBe(
      as.toUpperCase(),
    );
  });

  it.each(['regular', 'semibold'] as const)('supports %s weight', (weight) => {
    expect(mount(Text, { props: { weight } }).classes()).toContain(
      `wui-text--${weight}`,
    );
  });

  it('updates all props and forwards attributes and native listeners', async () => {
    const onClick = vi.fn();
    const wrapper = mount(Text, {
      attrs: {
        id: 'description',
        lang: 'en',
        'aria-describedby': 'help',
        'data-purpose': 'body',
        class: 'consumer',
        style: { color: 'red' },
        onClick,
      },
    });
    await wrapper.setProps({ as: 'span', weight: 'semibold' });
    expect(wrapper.element.tagName).toBe('SPAN');
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['wui-text--semibold', 'consumer']),
    );
    expect(wrapper.classes()).not.toContain('wui-text--regular');
    expect(wrapper.attributes()).toMatchObject({
      id: 'description',
      lang: 'en',
      'aria-describedby': 'help',
      'data-purpose': 'body',
    });
    expect((wrapper.element as HTMLElement).style.color).toBe('red');
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0]).toBeInstanceOf(MouseEvent);
    for (const attr of ['as', 'size', 'weight']) {
      expect(wrapper.attributes(attr)).toBeUndefined();
    }
  });
});
