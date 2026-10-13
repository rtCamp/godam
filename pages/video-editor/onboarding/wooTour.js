/**
 * Shared launcher for the WooCommerce Shoppable Video onboarding tour.
 *
 * Both first-run entry points — the Welcome chooser (Flow 2, Video Editor) and
 * the "You've unlocked Woo features" nudge (Flow 3, Dashboard) — use this to
 * hand off to the in-editor tour: flip the per-user tour state to "pending"
 * (read back by godam-for-woo in the block editor), create a blank draft page,
 * and open it in the editor with the ?godam_woo_tour=1 opt-in flag.
 *
 * Uses apiFetch (not raw fetch) so the REST nonce/root are resolved correctly on
 * any admin page — `window.videoData` only exists on the Video Editor page, so
 * the nudge on the Dashboard couldn't authenticate with the old manual nonce.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Absolute wp-admin base URL, derived from the current location's path up to and
 * including "/wp-admin/". Does NOT use videoData.adminUrl — that is localized as
 * a full settings URL (with query + #hash) on some pages, which would mangle the
 * built link. Path-based detection also handles subdirectory installs.
 *
 * @return {string} e.g. "https://site.test/wp-admin/".
 */
const adminBase = () => {
	const { origin, pathname } = window.location;
	const marker = '/wp-admin/';
	const idx = pathname.indexOf( marker );
	return origin + ( idx !== -1 ? pathname.slice( 0, idx + marker.length ) : marker );
};

/**
 * Mark the Shoppable Video tour as pending for the current user, so it
 * auto-starts the next time the block editor loads. Best-effort.
 *
 * @return {Promise<void>} Resolves once the request settles.
 */
export const setWooTourPending = async () => {
	try {
		await apiFetch( {
			path: '/godam/v1/product-gallery/tour-state',
			method: 'POST',
			data: { status: 'pending' },
		} );
	} catch {
		// Non-fatal — the URL flag still opts the editor into the tour.
	}
};

/**
 * Launch the Woo block tour: persist the "pending" state, then open a fresh page
 * editor with the ?godam_woo_tour=1 flag, where the tour auto-starts and walks
 * the user through inserting and configuring the Shoppable Video block.
 *
 * Navigates the current tab (window.location) rather than window.open — a new
 * tab opened after the await is unreliable (popup blockers) and there's nothing
 * to keep on the originating screen. Pending state is awaited first so the
 * editor reads it on load as the primary trigger, with the URL flag as backup.
 *
 * @return {Promise<void>}
 */
export const launchWooBlockTour = async () => {
	await setWooTourPending();
	window.location.href = `${ adminBase() }post-new.php?post_type=page&godam_woo_tour=1`;
};
