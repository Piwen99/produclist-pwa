import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';
import { ToastProvider } from '../useToast';

// Helper to wrap hook with provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('toast state management', () => {
    it('should have empty toasts initially', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      expect(result.current.toasts).toEqual([]);
    });

    it('toast.success() should add a toast with success type', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.success('Operation completed');
      });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        message: 'Operation completed',
        type: 'success',
      });
    });

    it('toast.error() should add a toast with error type', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.error('Something went wrong');
      });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        message: 'Something went wrong',
        type: 'error',
      });
    });

    it('toast.info() should add a toast with info type', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.info('Here is some info');
      });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        message: 'Here is some info',
        type: 'info',
      });
    });

    it('toast.warning() should add a toast with warning type', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.warning('Be careful');
      });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        message: 'Be careful',
        type: 'warning',
      });
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss success toast after 4 seconds', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.success('Auto-dismiss me');
      });
      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should auto-dismiss error toast after 6 seconds', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.error('Longer display for errors');
      });
      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should not dismiss before timeout', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.success('Do not dismiss');
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('multiple toasts stacking', () => {
    it('should stack multiple toasts', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.success('First');
        result.current.toast.error('Second');
        result.current.toast.info('Third');
      });

      expect(result.current.toasts).toHaveLength(3);
    });

    it('should dismiss oldest toast first when multiple auto-dismiss', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.success('First toast');
        result.current.toast.success('Second toast');
      });

      expect(result.current.toasts).toHaveLength(2);

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('dismiss individual toast', () => {
    it('should allow removing a specific toast by id', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.toast.success('Keep me');
        result.current.toast.success('Remove me');
      });

      const toastIdToRemove = result.current.toasts[1].id;

      act(() => {
        result.current.dismiss(toastIdToRemove);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Keep me');
    });
  });
});