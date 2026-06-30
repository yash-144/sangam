import { useEffect, useRef, useState } from 'react';

export function useInView<T extends HTMLElement>(rootMargin = '-80px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, visible] as const;
}
