import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.vue';

describe('Button', () => {
  it('renders a native primary button with slot content and safe type', () => {
    const wrapper = mount(Button, { slots: { default: 'Set sail' } });
    expect(wrapper.element.tagName).toBe('BUTTON');
    expect(wrapper.attributes('type')).toBe('button');
    expect(wrapper.classes()).toContain('wui-button--primary');
    expect(wrapper.text()).toBe('Set sail');
  });

  it.each(['primary', 'default', 'outlined', 'subtle'] as const)(
    'supports %s variant',
    (variant) => {
      expect(mount(Button, { props: { variant } }).classes()).toContain(
        `wui-button--${variant}`,
      );
    },
  );

  it.each(['button', 'submit', 'reset'] as const)(
    'preserves native %s type',
    (type) => {
      expect(mount(Button, { props: { type } }).attributes('type')).toBe(type);
    },
  );

  it('forwards attributes, classes, styles and listeners to the native root', async () => {
    const onClick = vi.fn();
    const wrapper = mount(Button, {
      attrs: {
        id: 'launch',
        name: 'action',
        value: 'launch',
        'aria-describedby': 'help',
        'data-purpose': 'test',
        class: 'consumer',
        style: { color: 'red' },
        onClick,
      },
    });
    expect(wrapper.attributes()).toMatchObject({
      id: 'launch',
      name: 'action',
      value: 'launch',
      'aria-describedby': 'help',
      'data-purpose': 'test',
    });
    expect(wrapper.classes()).toContain('consumer');
    expect(wrapper.element.style.color).toBe('red');
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]?.[0]).toBeInstanceOf(MouseEvent);
  });

  it.each(['primary', 'default', 'outlined', 'subtle'] as const)(
    'uses native disabled behavior with %s and updates reactively',
    async (variant) => {
      const onClick = vi.fn();
      const wrapper = mount(Button, {
        props: { disabled: true, variant },
        attrs: { onClick },
      });
      expect(wrapper.element.disabled).toBe(true);
      wrapper.element.click();
      expect(onClick).not.toHaveBeenCalled();
      await wrapper.setProps({ disabled: false, variant: 'outlined' });
      wrapper.element.click();
      expect(onClick).toHaveBeenCalledOnce();
      expect(wrapper.classes()).toContain('wui-button--outlined');
    },
  );
});
