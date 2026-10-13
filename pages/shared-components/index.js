/**
 * Shared GoDAM admin components — exposed on a `window.GoDAM` global so
 * separate plugins (e.g. godam-for-woo) can reuse them without duplicating the
 * source (DRY). The bundle inherits the same React / @wordpress/* externals as
 * the other `pages/*` entries, so it never re-bundles React or wp-components.
 *
 * Consumers enqueue the `godam-shared-components` script as a dependency and
 * read e.g. `const { DateRangePicker } = window.GoDAM;`.
 *
 * Mirrors the existing add-on handshake pattern used by
 * `window.godamVideoEditorComponents` / `window.registerGodamDashboardSection`.
 */

/**
 * Internal dependencies
 */
import DateRangePicker from '../analytics/components/DateRangePicker';

// Spread-merge so an add-on that seeded the namespace earlier is preserved.
window.GoDAM = {
	...( window.GoDAM || {} ),
	DateRangePicker,
};
