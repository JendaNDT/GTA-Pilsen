const ERROR_HISTORY_LIMIT = 10;

export function createCrashGuard({ limit = 3, windowMs = 2000, now = () => performance.now() } = {}) {
  const errors = [];
  const frameErrors = [];
  let fatal = false;

  function record(error) {
    const time = now();
    let message = 'Neznámá chyba';
    let stack = '';
    try {
      message = typeof error?.message === 'string' ? error.message : String(error);
      if (typeof error?.stack === 'string') stack = error.stack;
    } catch {
      // I vyhozená hodnota, kterou nejde převést na text, se zaznamená.
    }
    const entry = { time, message, stack };
    if (errors.length === ERROR_HISTORY_LIMIT) errors.shift();
    errors.push(entry);
    return entry;
  }

  return {
    errors,
    record,
    get fatal() { return fatal; },
    run(fn, value) {
      if (fatal) return false;
      try {
        fn(value);
        return true;
      } catch (error) {
        const { time } = record(error);
        while (frameErrors.length && frameErrors[0] < time - windowMs) frameErrors.shift();
        frameErrors.push(time);
        fatal = frameErrors.length >= limit;
        return false;
      }
    },
  };
}
