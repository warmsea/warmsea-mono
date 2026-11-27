import { flushPromises, mount } from '@vue/test-utils';
import { h, nextTick, ref, Teleport, withModifiers } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import * as library from '../../index';
import ChatInput from './ChatInput.vue';

const wrappers: { unmount(): void }[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
const props = {
  modelValue: '  Draft  ',
  label: 'Message',
  submitLabel: 'Send',
  canSubmit: true,
};
function render(extra = {}) {
  const wrapper = mount(ChatInput, { props: { ...props, ...extra } });
  wrappers.push(wrapper);
  return wrapper;
}
describe('ChatInput', () => {
  it('emits the unchanged value for Enter and form submit without clearing', async () => {
    expect(library).toHaveProperty('ChatInput', ChatInput);
    const wrapper = render();
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toEqual([['  Draft  '], ['  Draft  ']]);
    expect(wrapper.get('textarea').element.value).toBe('  Draft  ');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
  it('keeps editing controlled and accepts only parent model changes', async () => {
    const wrapper = render();
    await wrapper.get('textarea').setValue('New draft');
    expect(wrapper.emitted('update:modelValue')).toEqual([['New draft']]);
    expect(wrapper.get('textarea').element.value).toBe('  Draft  ');
    await wrapper.setProps({ modelValue: 'Accepted' });
    expect(wrapper.get('textarea').element.value).toBe('Accepted');
  });
  it.each([false, true])(
    'cancels native reset and notifies the consumer once (accept reset: %s)',
    async (accept) => {
      const draft = ref(props.modelValue);
      const received: Event[] = [];
      const wrapper = mount(
        () =>
          h(ChatInput, {
            ...props,
            modelValue: draft.value,
            onReset: withModifiers(
              (event: Event) => {
                received.push(event);
                if (accept) draft.value = '';
              },
              ['prevent'],
            ),
          }),
        { attachTo: document.body },
      );
      wrappers.push(wrapper);
      const composer = wrapper.findComponent(ChatInput);
      const form = wrapper.get('form').element;
      let nativeEvent: Event | undefined;
      form.addEventListener('reset', (event) => {
        nativeEvent = event;
      });
      form.reset();
      await nextTick();
      expect(received).toEqual([nativeEvent]);
      expect(nativeEvent?.defaultPrevented).toBe(true);
      expect(composer.emitted('reset')).toEqual([[nativeEvent]]);
      expect(composer.emitted('update:modelValue')).toBeUndefined();
      expect(wrapper.get('textarea').element.value).toBe(
        accept ? '' : props.modelValue,
      );
      await wrapper.get('textarea').trigger('reset');
      expect(received).toHaveLength(1);
      await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
      expect(composer.emitted('submit')).toEqual([
        [accept ? '' : props.modelValue],
      ]);
    },
  );
  it('prevents owned reset without a consumer handler or automatic model edits', async () => {
    const wrapper = render();
    const event = new Event('reset', { bubbles: true, cancelable: true });
    wrapper.get('form').element.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted('reset')).toEqual([[event]]);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.get('textarea').element.value).toBe(props.modelValue);
  });
  it.each(['form', 'FORM', 'fOrM'])(
    'reserves %s association so required validation cannot escape the owned form',
    async (attribute) => {
      const wrapper = mount(
        () =>
          h('div', [
            h('form', { id: 'external' }),
            h(ChatInput, {
              ...props,
              modelValue: '',
              [attribute]: 'external',
              required: true,
            }),
          ]),
        { attachTo: document.body },
      );
      wrappers.push(wrapper);
      const composer = wrapper.findComponent(ChatInput);
      const input = composer.get('textarea');
      expect(input.element.form).toBe(composer.get('form').element);
      expect(input.attributes('form')).toBeUndefined();
      await input.trigger('keydown', { key: 'Enter' });
      await composer.get('form').trigger('submit');
      expect(composer.emitted('submit')).toBeUndefined();
    },
  );
  it.each([false, true])(
    'refreshes native slot state after local disabled transitions (first legend: %s)',
    async (legend) => {
      const disabled = ref(true);
      const composer = () =>
        h(
          ChatInput,
          { ...props, disabled: disabled.value },
          {
            'actions-end': ({
              disabled,
              canSubmit,
            }: library.ChatInputSlotState) =>
              h('output', `${disabled}/${canSubmit}`),
          },
        );
      const wrapper = mount(
        () =>
          h('fieldset', { disabled: true }, [
            h('legend', legend ? [composer()] : 'Prompt'),
            ...(legend ? [] : [composer()]),
          ]),
        { attachTo: document.body },
      );
      wrappers.push(wrapper);
      expect(wrapper.get('output').text()).toBe('true/false');
      disabled.value = false;
      await nextTick();
      await nextTick();
      expect(wrapper.get('output').text()).toBe(
        legend ? 'false/true' : 'true/false',
      );
      await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
      expect(wrapper.findComponent(ChatInput).emitted('submit')).toEqual(
        legend ? [[props.modelValue]] : undefined,
      );
      disabled.value = true;
      await nextTick();
      await nextTick();
      expect(wrapper.get('output').text()).toBe('true/false');
    },
  );
  it('measures restored controlled content after the parent rejects an edit', async () => {
    const wrapper = render({ modelValue: '' });
    const input = wrapper.get('textarea');
    Object.defineProperty(input.element, 'scrollHeight', {
      get: () => (input.element.value.length > 100 ? 300 : 20),
    });
    const stored = 'Long controlled draft '.repeat(20);
    await wrapper.setProps({ modelValue: stored });
    await flushPromises();
    const originalHeight = input.element.style.height;
    await input.setValue('');
    await flushPromises();
    expect(input.element.value).toBe(stored);
    expect(input.element.style.height).toBe(originalHeight);
  });
  it('tracks native slot state and new ancestor mutations after Teleport moves', async () => {
    const host = document.createElement('div');
    host.innerHTML =
      '<fieldset disabled><legend>Disabled</legend><div></div></fieldset><fieldset><legend>Enabled</legend><div></div></fieldset>';
    document.body.append(host);
    const [disabled, enabled] = host.querySelectorAll('fieldset');
    const disabledTarget = disabled!.querySelector('div')!;
    const enabledTarget = enabled!.querySelector('div')!;
    const target = ref<HTMLElement>(disabledTarget);
    const wrapper = mount(
      () =>
        h(Teleport, { to: target.value }, [
          h(ChatInput, props, {
            'actions-end': (state: library.ChatInputSlotState) =>
              h('output', `${state.disabled}/${state.canSubmit}`),
          }),
        ]),
      { attachTo: host },
    );
    wrappers.push({
      unmount() {
        wrapper.unmount();
        host.remove();
      },
    });
    const form = host.querySelector('form')!;
    const input = form.querySelector('textarea')!;
    const output = form.querySelector('output')!;
    const send = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
    const settled = async () => {
      await nextTick();
      await flushPromises();
      await nextTick();
    };
    await settled();
    expect(output.textContent).toBe('true/false');
    target.value = enabledTarget;
    await settled();
    expect(host.querySelector('form')).toBe(form);
    expect(input.matches(':disabled')).toBe(false);
    expect(output.textContent).toBe('false/true');
    expect(send.disabled).toBe(false);
    enabled!.disabled = true;
    await settled();
    expect(output.textContent).toBe('true/false');
    target.value = disabled!.querySelector('legend')!;
    await settled();
    expect(input.matches(':disabled')).toBe(false);
    expect(output.textContent).toBe('false/true');
    target.value = disabledTarget;
    await settled();
    expect(input.matches(':disabled')).toBe(true);
    expect(output.textContent).toBe('true/false');
    expect(send.disabled).toBe(true);
    enabled!.disabled = false;
    await settled();
    expect(output.textContent).toBe('true/false');
    target.value = disabled!.querySelector('legend')!;
    await settled();
    expect(output.textContent).toBe('false/true');
    const firstLegend = document.createElement('legend');
    firstLegend.textContent = 'New first legend';
    disabled!.prepend(firstLegend);
    await settled();
    expect(output.textContent).toBe('true/false');
    firstLegend.remove();
    await settled();
    expect(output.textContent).toBe('false/true');
  });
  it('preserves composition and Shift+Enter without submitting', async () => {
    const wrapper = render();
    const input = wrapper.get('textarea');
    await input.trigger('compositionstart');
    input.element.value = 'Composed';
    await input.trigger('input', { isComposing: true });
    await input.trigger('keydown', { key: 'Enter' });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    await input.trigger('compositionend');
    await input.trigger('input');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Composed']]);
    await wrapper.setProps({ modelValue: 'Composed' });
    for (const extra of [
      { shiftKey: true },
      { isComposing: true },
      { keyCode: 229 },
    ])
      await input.trigger('keydown', { key: 'Enter', ...extra });
    expect(wrapper.emitted('submit')).toBeUndefined();
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('submit')).toEqual([['Composed']]);
  });
  it.each(['disabled', 'readonly', 'canSubmit', 'fieldset'])(
    'blocks both submission paths when %s prohibits submission',
    async (state) => {
      const wrapper = mount(
        () =>
          h('fieldset', { disabled: state === 'fieldset' }, [
            h(ChatInput, {
              ...props,
              disabled: state === 'disabled',
              readonly: state === 'readonly',
              canSubmit: state !== 'canSubmit',
            }),
          ]),
        { attachTo: document.body },
      );
      wrappers.push(wrapper);
      await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
      await wrapper.get('form').trigger('submit');
      expect(
        wrapper.findComponent(ChatInput).emitted('submit'),
      ).toBeUndefined();
    },
  );
  it('supports attachment-only eligibility without inferring content or clearing it', async () => {
    const wrapper = render({ modelValue: '' });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toEqual([['']]);
    await wrapper.setProps({ canSubmit: false });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });
  it('honors native required validation on Enter as well as native submit', async () => {
    const wrapper = mount(ChatInput, {
      props: { ...props, modelValue: '' },
      attrs: { required: true },
    });
    wrappers.push(wrapper);
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    await wrapper.setProps({ modelValue: 'Valid' });
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('submit')).toEqual([['Valid']]);
  });
  it('does not use a slotted attachment preview as its editable control', async () => {
    const wrapper = mount(ChatInput, {
      props,
      slots: {
        attachments: () => h('textarea', { disabled: true, value: 'Preview' }),
      },
    });
    wrappers.push(wrapper);
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toEqual([['  Draft  ']]);
    expect(wrapper.findAll('textarea')[0]!.element.style.height).toBe('');
  });
  it('reacts to a changed ancestor fieldset and focuses only on explicit request', async () => {
    const wrapper = mount(() => h('fieldset', [h(ChatInput, props)]), {
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    const composer = wrapper.findComponent(ChatInput);
    const fieldset = wrapper.get('fieldset').element;
    fieldset.disabled = true;
    await nextTick();
    await nextTick();
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeDefined();
    await wrapper.get('form').trigger('submit');
    expect(composer.emitted('submit')).toBeUndefined();
    fieldset.disabled = false;
    await nextTick();
    await nextTick();
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeUndefined();
    expect(document.activeElement).not.toBe(wrapper.get('textarea').element);
    composer.vm.focus();
    expect(document.activeElement).toBe(wrapper.get('textarea').element);
    await wrapper.get('form').trigger('submit');
    expect(composer.emitted('submit')).toHaveLength(1);
  });
  it('links hint and error text with external descriptions and forwards native attributes', async () => {
    const wrapper = mount(ChatInput, {
      props: { ...props, keyboardHint: 'Enter sends', errorText: 'Too large' },
      attrs: {
        id: 'prompt',
        class: 'local',
        name: 'prompt',
        maxlength: 40,
        'aria-describedby': 'external external',
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.classes()).toContain('local');
    const input = wrapper.get('textarea');
    expect(input.attributes()).toMatchObject({
      id: 'prompt',
      name: 'prompt',
      maxlength: '40',
      'aria-label': 'Message',
      'aria-invalid': 'true',
    });
    const ids = (input.attributes('aria-describedby') ?? '').split(/\s+/);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('external');
    for (const text of ['Enter sends', 'Too large']) {
      const description = wrapper
        .findAll('[id]')
        .find((item) => item.text() === text);
      expect(description).toBeDefined();
      expect(ids).toContain(description!.attributes('id'));
    }
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
    await nextTick();
  });
  it('exposes state to application actions and keeps the native submit button', () => {
    const wrapper = mount(ChatInput, {
      props: { ...props, disabled: true },
      slots: {
        attachments: () => h('span', 'Application attachment'),
        'actions-end': ({ disabled, canSubmit, isComposing }) =>
          h(
            'button',
            { type: 'button', disabled },
            `${canSubmit}/${isComposing}`,
          ),
        'submit-content': () => h('span', 'Send icon'),
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.text()).toContain('Application attachment');
    expect(wrapper.text()).toContain('false/false');
    expect(wrapper.get('button[type="submit"]').attributes('aria-label')).toBe(
      'Send',
    );
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeDefined();
  });
});
