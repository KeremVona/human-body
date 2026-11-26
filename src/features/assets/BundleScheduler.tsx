import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { usePreviewState } from '../../scene/previewState';
import { bundleStarted } from './assetsSlice';
import { BUNDLE_LOAD_ORDER, nextBundleToLoad } from './scheduler';

/** Non-visual component advancing the progressive single-bundle download queue. */
export function BundleScheduler() {
  const dispatch = useAppDispatch();
  const boot = useAppSelector((s) => s.assets.boot);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const bundles = useAppSelector((s) => s.assets.bundles);
  const requested = useAppSelector((s) => s.assets.requested);
  const preview = usePreviewState();

  useEffect(() => {
    if (boot !== 'ready') return;
    const next = nextBundleToLoad(bundles, BUNDLE_LOAD_ORDER, requested);
    if (!next) return;
    if (next === 'skeletal' && manifest?.preview && preview === 'loading') {
      const timer = window.setTimeout(() => {
        dispatch(bundleStarted('skeletal'));
      }, 4000);
      return () => window.clearTimeout(timer);
    }
    dispatch(bundleStarted(next));
  }, [boot, manifest, bundles, requested, preview, dispatch]);

  return null;
}
