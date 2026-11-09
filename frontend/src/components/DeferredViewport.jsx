import useInView from '../hooks/useInView';

/**
 * Mount children only when near the viewport — avoids loading JS for below-the-fold UI.
 */
export default function DeferredViewport({
  children,
  fallback = null,
  minHeight = '8rem',
  rootMargin = '320px 0px',
}) {
  const [ref, inView] = useInView({ rootMargin });

  return (
    <div ref={ref} className="deferred-viewport" style={inView ? undefined : { minHeight }}>
      {inView ? children : fallback}
    </div>
  );
}
