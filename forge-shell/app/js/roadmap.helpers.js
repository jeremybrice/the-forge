/* ═══════════════════════════════════════════════════════════════
   Roadmap Helpers — pure logic for release resolution + optimistic guard.
   Importable as <script> (window.RoadmapHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RoadmapHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Case-insensitive release name equality. Nullish values only equal each other. */
  function nameEqualsRelease(a, b) {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  /**
   * Clear schedule on frontmatter. Sets release = null only (never delete).
   * Mutates and returns fm.
   */
  function clearReleaseFm(fm) {
    if (!fm || typeof fm !== 'object') return fm;
    fm.release = null;
    return fm;
  }

  /** Inclusive start/end date overlap (ISO date strings compare lexicographically). */
  function releaseOverlapsPeriod(release, period) {
    if (!release || !release.start_date || !release.end_date) return false;
    if (!period || !period.start || !period.end) return false;
    return release.start_date <= period.end && release.end_date >= period.start;
  }

  function releasesOverlappingPeriod(releases, period) {
    if (!Array.isArray(releases) || !period) return [];
    return releases.filter(function (r) {
      return releaseOverlapsPeriod(r, period);
    });
  }

  /**
   * Resolve a period-column drop to a release assignment decision.
   *
   * Truth table (set = releases overlapping period):
   *   |set|=0                         → none
   *   |set|=1, prefInSet              → noop
   *   |set|=1, no pref / not in set   → single (set[0].name)
   *   |set|>1, prefInSet              → noop
   *   |set|>1, not prefInSet          → ambiguous
   *
   * Unscheduled column: pass period null / { unscheduled: true } → clear|noop.
   * (Callers may also handle Unscheduled themselves via clearReleaseFm.)
   *
   * @returns {{ kind: string, releaseName?: string, releases?: Array }}
   */
  function resolveDropToRelease(period, releases, preferredName) {
    if (period == null || period.unscheduled === true || period.index === 'unscheduled') {
      if (preferredName == null || preferredName === '') {
        return { kind: 'noop' };
      }
      return { kind: 'clear' };
    }

    var set = releasesOverlappingPeriod(releases, period);
    if (set.length === 0) {
      return { kind: 'none', releases: set };
    }

    var prefInSet = false;
    if (preferredName != null && preferredName !== '') {
      for (var i = 0; i < set.length; i++) {
        if (nameEqualsRelease(set[i].name, preferredName)) {
          prefInSet = true;
          break;
        }
      }
    }

    if (set.length === 1) {
      if (prefInSet) return { kind: 'noop', releaseName: set[0].name, releases: set };
      return { kind: 'single', releaseName: set[0].name, releases: set };
    }

    /* set.length > 1 */
    if (prefInSet) return { kind: 'noop', releases: set };
    return { kind: 'ambiguous', releases: set };
  }

  /**
   * Labels of periods that a release spans (overlap-based).
   */
  function periodLabelsForRelease(release, periods) {
    if (!Array.isArray(periods)) return [];
    var labels = [];
    for (var i = 0; i < periods.length; i++) {
      if (releaseOverlapsPeriod(release, periods[i])) {
        labels.push(periods[i].label);
      }
    }
    return labels;
  }

  /**
   * Decide how refresh should treat a scanned file vs optimistic pending write.
   *
   * pendingEntry: { expectedContent, writtenAt } | null
   * returns: 'apply' | 'skip' | 'apply-and-clear' | 'force-apply-ttl'
   */
  function guardDecision(pendingEntry, diskContent, now, ttlMs) {
    if (!pendingEntry) return 'apply';
    if (diskContent === pendingEntry.expectedContent) return 'apply-and-clear';
    if (now - pendingEntry.writtenAt < ttlMs) return 'skip';
    return 'force-apply-ttl';
  }

  /** Relative path under cards/ for ForgeFS.writeFile. */
  function cardRelativePath(card) {
    if (!card) return '';
    return (card.dirName || '') + '/' + (card.filename || '') + '.md';
  }

  return {
    nameEqualsRelease: nameEqualsRelease,
    clearReleaseFm: clearReleaseFm,
    releaseOverlapsPeriod: releaseOverlapsPeriod,
    releasesOverlappingPeriod: releasesOverlappingPeriod,
    resolveDropToRelease: resolveDropToRelease,
    periodLabelsForRelease: periodLabelsForRelease,
    guardDecision: guardDecision,
    cardRelativePath: cardRelativePath
  };
});
