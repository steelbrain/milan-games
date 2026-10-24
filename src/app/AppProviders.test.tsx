import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { line } from '../content/line';
import { useAnnouncement, useAudio } from '../services/audio';
import { useServices } from '../services/services';
import { createMemoryStore } from '../services/storage';
import { createTestServices, type TestServices } from '../test/fakes';
import { AppProviders } from './AppProviders';

function wrapperFor(services: TestServices) {
  return ({ children }: { children: ReactNode }) => (
    <AppProviders services={services}>{children}</AppProviders>
  );
}

describe('audio', () => {
  it('speaks and plays when not muted', () => {
    const services = createTestServices({ strictSpeech: false });
    const { result } = renderHook(() => useAudio(), { wrapper: wrapperFor(services) });
    act(() => result.current.say(line('Hello'), line('there')));
    act(() => result.current.play('tap'));
    expect(services.speaker.texts).toEqual(['Hello', 'there']);
    expect(services.sounds.cues).toEqual(['tap']);
  });

  it('goes quiet when muted, stops current speech, and remembers', () => {
    const services = createTestServices({ strictSpeech: false });
    const { result } = renderHook(() => useAudio(), { wrapper: wrapperFor(services) });
    act(() => result.current.setMuted(true));
    act(() => result.current.say(line('Hello')));
    act(() => result.current.play('tap'));
    expect(result.current.muted).toBe(true);
    expect(services.speaker.stops).toBe(1);
    expect(services.speaker.texts).toEqual([]);
    expect(services.sounds.cues).toEqual([]);
    expect(services.store.read('muted')).toBe(true);
  });

  it('starts muted if it was muted last time', () => {
    const services = createTestServices({
      store: createMemoryStore({ muted: true }),
      strictSpeech: false,
    });
    const { result } = renderHook(() => useAudio(), { wrapper: wrapperFor(services) });
    expect(result.current.muted).toBe(true);
  });

  it('ignores a corrupt stored setting', () => {
    const services = createTestServices({
      store: createMemoryStore({ muted: 'yes' }),
      strictSpeech: false,
    });
    const { result } = renderHook(() => useAudio(), { wrapper: wrapperFor(services) });
    expect(result.current.muted).toBe(false);
  });
});

describe('useAnnouncement', () => {
  function Announcer({ text, extra }: { text: string; extra: number }) {
    useAnnouncement(line(text));
    return <p>{extra}</p>;
  }

  it('speaks on mount and when the words change, not on every render', () => {
    const services = createTestServices({ strictSpeech: false });
    const Wrapper = wrapperFor(services);
    const { rerender } = render(<Announcer text="Hi" extra={1} />, { wrapper: Wrapper });
    rerender(<Announcer text="Hi" extra={2} />);
    expect(services.speaker.texts).toEqual(['Hi']);
    rerender(<Announcer text="Bye" extra={2} />);
    expect(services.speaker.texts).toEqual(['Hi', 'Bye']);
  });

  it('says nothing for an undefined line', () => {
    const services = createTestServices({ strictSpeech: false });
    renderHook(() => useAnnouncement(undefined), { wrapper: wrapperFor(services) });
    expect(services.speaker.texts).toEqual([]);
  });
});

describe('outside the providers', () => {
  it('fails loudly instead of silently doing nothing', () => {
    expect(() => renderHook(() => useAudio())).toThrow(/AppProviders/);
    expect(() => renderHook(() => useServices())).toThrow(/AppProviders/);
  });
});

describe('mute toggle wiring', () => {
  it('re-announces nothing when unmuting a static line', async () => {
    const services = createTestServices({ strictSpeech: false });
    function Panel() {
      const { muted, setMuted } = useAudio();
      return (
        <button type="button" onClick={() => setMuted(!muted)}>
          {muted ? 'unmute' : 'mute'}
        </button>
      );
    }
    render(<Panel />, { wrapper: wrapperFor(services) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'mute' }));
    expect(screen.getByRole('button', { name: 'unmute' })).toBeInTheDocument();
    expect(services.speaker.stops).toBe(1);
  });
});
