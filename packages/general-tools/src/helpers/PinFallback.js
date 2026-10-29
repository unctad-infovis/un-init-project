/**
 * True when position: sticky cannot work for el: an ancestor is a scroll container (overflow hidden/auto/scroll) that never actually scrolls.
 * A host page that sets overflow-x: hidden on both html and body does this (unctad.org below ~992px), because then body no longer hands its overflow to the viewport.
 */
export const stickyBroken = el => {
  const root = document.documentElement;
  const rs = getComputedStyle(root);
  const rootScrolls = rs.overflowX !== 'visible' || rs.overflowY !== 'visible';
  for (let e = el.parentElement; e && e !== root; e = e.parentElement) {
    const c = getComputedStyle(e);
    if (!/hidden|auto|scroll/.test(c.overflowX + c.overflowY)) continue;
    if (e === document.body && !rootScrolls) continue;
    if (e.scrollHeight <= e.clientHeight + 1) return true;
  }
  return false;
};

/**
 * Keeps a position: sticky element in place with position: fixed when sticky is dead (see stickyBroken), the way sticky would:
 * static until its natural place reaches topFn(height), fixed there while the box (default: its parent) passes, parked at the bottom of the box after that.
 * Does nothing where sticky works. Returns a cleanup. Use in an effect: useEffect(() => pinFallback(ref.current, () => 0), []).
 */
const pinFallback = (el, topFn, box = el.parentElement) => {
  let broken = false;
  let left = 0;
  let natural = 0;
  let padBottom = 0;
  let width = 0;
  let forcedRelative = false;
  let mode = '';
  let frame = 0;
  const set = (position, top, x) => {
    el.style.boxSizing = 'border-box';
    el.style.position = position;
    el.style.top = `${top}px`;
    el.style.left = `${x}px`;
    el.style.width = `${width}px`;
  };
  const reset = () => {
    mode = '';
    el.style.animation = '';
    el.style.boxSizing = '';
    el.style.position = '';
    el.style.top = '';
    el.style.left = '';
    el.style.width = '';
  };
  const update = () => {
    frame = 0;
    if (!broken) return;
    const r = box.getBoundingClientRect();
    const h = el.offsetHeight;
    const t = topFn(h);
    if (r.top + natural >= t) {
      if (mode) reset();
    } else if (r.bottom - padBottom - h <= t) {
      mode = 'after';
      el.style.animation = 'none'; // an animation of top (BackToTop bounces) would beat the inline top
      set('absolute', r.height - padBottom - h, left);
    } else {
      mode = 'pinned';
      set('fixed', t, r.left + left);
    }
  };
  const measure = () => {
    reset();
    broken = stickyBroken(el);
    if (broken && getComputedStyle(box).position === 'static') {
      box.style.position = 'relative';
      forcedRelative = true;
    } else if (!broken && forcedRelative) {
      box.style.position = '';
      forcedRelative = false;
    }
    left = el.offsetLeft;
    padBottom = Number.parseFloat(getComputedStyle(box).paddingBottom) || 0;
    natural = el.offsetTop;
    width = el.offsetWidth;
    update();
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const ro = new ResizeObserver(measure);
  ro.observe(box);
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    ro.disconnect();
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(frame);
    reset();
    if (forcedRelative) box.style.position = '';
  };
};

export default pinFallback;
