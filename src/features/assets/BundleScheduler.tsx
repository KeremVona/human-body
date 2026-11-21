import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { bundleStarted } from './assetsSlice';
import { BUNDLE_LOAD_ORDER, nextBundleToLoad } from './scheduler';

/** Non-visual component advancing the progressive single-bundle download queue. */
export function BundleScheduler() {
  const dispatch = useAppDispatch();
  const boot = useAppSelector((s) => s.assets.boot);
  const bundles = useAppSelector((s) => s.assets.bundles);
  const requested = useAppSelector((s) => s.assets.requested);

  useEffect(() => {
    if (boot !== 'ready') return;
    const next = nextBundleToLoad(bundles, BUNDLE_LOAD_ORDER, requested);
    if (next) {
      dispatch(bundleStarted(next));
    }
  }, [boot, bundles, requested, dispatch]);

  return null;
}
