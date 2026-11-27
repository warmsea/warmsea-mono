import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import Heading from './Heading.vue';

describe('Heading', () => {
  it.each([1, 2, 3, 4, 5, 6] as const)(
    'renders native h%s with the matching appearance and slot markup',
    (level) => {
      const wrapper = mount(Heading, {
        props: { level },
        slots: { default: 'Explore <em>Warmsea</em>' },
      });
      expect(wrapper.element.tagName).toBe(`H${level}`);
      expect(wrapper.classes()).toEqual([
        'wui-heading',
        `wui-heading--${level}`,
      ]);
      expect(wrapper.find('em').text()).toBe('Warmsea');
      for (const attr of ['level', 'role', 'tabindex']) {
        expect(wrapper.attributes(attr)).toBeUndefined();
      }
    },
  );

  it('updates the semantic root and visual level together', async () => {
    const wrapper = mount(Heading, { props: { level: 2 } });
    await wrapper.setProps({ level: 4 });
    expect(wrapper.element.tagName).toBe('H4');
    expect(wrapper.classes()).toContain('wui-heading--4');
    expect(wrapper.classes()).not.toContain('wui-heading--2');
  });

  it('preserves native attributes, styles and listeners when the root changes', async () => {
    const onClick = vi.fn();
    const wrapper = mount(Heading, {
      props: { level: 1 },
      attrs: {
        id: 'destination',
        'aria-describedby': 'description',
        'data-purpose': 'heading',
        class: 'consumer',
        style: { color: 'red' },
        onClick,
      },
    });
    await wrapper.setProps({ level: 2 });
    expect(wrapper.attributes()).toMatchObject({
      id: 'destination',
      'aria-describedby': 'description',
      'data-purpose': 'heading',
    });
    expect(wrapper.classes()).toContain('consumer');
    expect((wrapper.element as HTMLElement).style.color).toBe('red');
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0]).toBeInstanceOf(MouseEvent);
  });
});
