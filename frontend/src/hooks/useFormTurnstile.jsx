import { useCallback, useState } from 'react';
import FormTurnstile, { turnstileRequired } from '../components/FormTurnstile';

export function useFormTurnstile() {
  const [token, setToken] = useState('');
  const required = turnstileRequired();

  const assertReady = useCallback(() => {
    if (required && !token) {
      throw new Error('Please complete the security check');
    }
  }, [required, token]);

  const reset = useCallback(() => setToken(''), []);

  const widget = <FormTurnstile onToken={setToken} />;

  return { token, required, assertReady, reset, widget };
}
