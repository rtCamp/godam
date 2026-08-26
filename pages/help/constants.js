/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Base URL of the public GoDAM site.
 *
 * The docs hubs and the site-wide search both live here. Change this single
 * constant to point the Help page at a different environment.
 */
export const GODAM_SITE_URL = 'https://godam.io';

/**
 * Base URL of the documentation hubs.
 */
export const GODAM_DOCS_URL = `${ GODAM_SITE_URL }/docs`;

/**
 * Build the site search URL for a given query.
 *
 * Mirrors the docs landing page, which submits a plain `?s=` search against
 * the site root, so spaces are encoded as `+` rather than `%20`.
 *
 * @param {string} query Search term.
 * @return {string} Absolute search URL.
 */
export const getDocsSearchUrl = ( query ) => {
	const params = new URLSearchParams( { s: query } );

	return `${ GODAM_SITE_URL }/?${ params.toString() }`;
};

/**
 * Documentation hubs, grouped the same way as the GoDAM docs landing page.
 *
 * Each hub renders as a card. A hub without a `slug` has no docs hub yet, so
 * its card renders with a disabled action and a status badge instead.
 *
 * @return {Array} Sections, each with a label, description and list of hubs.
 */
export const getHubSections = () => [
	{
		id: 'on-your-site',
		label: __( 'On your site', 'godam' ),
		description: __( 'Platform-specific hubs where you install and configure GoDAM.', 'godam' ),
		hubs: [
			{
				id: 'wordpress',
				icon: 'wordpress',
				eyebrow: __( 'Core · WordPress', 'godam' ),
				title: __( 'GoDAM for WordPress', 'godam' ),
				description: __( 'The WordPress plugin: upload, transcode, blocks, page builders, interactive layers, integrations & analytics.', 'godam' ),
				badge: __( '70+ articles', 'godam' ),
				slug: 'wordpress',
			},
			{
				id: 'woocommerce',
				icon: 'woocommerce',
				eyebrow: __( 'Add-on · WooCommerce', 'godam' ),
				title: __( 'GoDAM for WooCommerce', 'godam' ),
				description: __( 'Make your store shoppable — shoppable video, product reels and product hotspots.', 'godam' ),
				badge: __( '5 articles', 'godam' ),
				slug: 'woo',
			},
			{
				id: 'shopify',
				icon: 'shopify',
				eyebrow: __( 'Add-on · Shopify', 'godam' ),
				title: __( 'GoDAM for Shopify', 'godam' ),
				description: __( 'Shoppable video for Shopify stores — same commerce experience, built for Shopify.', 'godam' ),
				badge: __( 'Coming soon', 'godam' ),
				badgeVariant: 'neutral',
			},
		],
	},
	{
		id: 'the-cloud-platform',
		label: __( 'The cloud platform', 'godam' ),
		description: __( 'Central management and the shared engine behind every product.', 'godam' ),
		hubs: [
			{
				id: 'central',
				icon: 'central',
				eyebrow: __( 'SaaS · app.godam', 'godam' ),
				title: __( 'GoDAM Central', 'godam' ),
				description: __( 'Your cloud DAM — media, playlists, teams, billing and player settings.', 'godam' ),
				badge: __( '8 articles', 'godam' ),
				slug: 'central',
			},
			{
				id: 'platform',
				icon: 'platform',
				eyebrow: __( 'Platform · Engine', 'godam' ),
				title: __( 'How GoDAM works', 'godam' ),
				description: __( 'The shared engine — transcoding, adaptive streaming, codecs, AI and delivery, documented once.', 'godam' ),
				badge: __( 'Concepts', 'godam' ),
				slug: 'platform',
			},
		],
	},
	{
		id: 'on-your-devices',
		label: __( 'On your devices', 'godam' ),
		description: __( 'Capture tools for browser and mobile.', 'godam' ),
		hubs: [
			{
				id: 'chrome',
				icon: 'chrome',
				eyebrow: __( 'Device · Extension', 'godam' ),
				title: __( 'GoDAM Screen Recorder for Chrome', 'godam' ),
				description: __( 'Record your screen from Chrome and send it straight to GoDAM.', 'godam' ),
				badge: __( '2 articles', 'godam' ),
				slug: 'chrome',
			},
			{
				id: 'ios',
				icon: 'ios',
				eyebrow: __( 'Device · iPhone', 'godam' ),
				title: __( 'GoDAM for iOS', 'godam' ),
				description: __( 'Capture, record and upload to GoDAM straight from your iPhone.', 'godam' ),
				badge: __( 'Coming soon', 'godam' ),
				badgeVariant: 'neutral',
			},
			{
				id: 'macos',
				icon: 'macos',
				eyebrow: __( 'Device · Mac', 'godam' ),
				title: __( 'GoDAM for macOS', 'godam' ),
				description: __( 'Screen recording on macOS.', 'godam' ),
				badge: __( 'Planned', 'godam' ),
				badgeVariant: 'neutral',
			},
			{
				id: 'android',
				icon: 'android',
				eyebrow: __( 'Device · Android', 'godam' ),
				title: __( 'GoDAM for Android', 'godam' ),
				description: __( 'Capture on Android.', 'godam' ),
				badge: __( 'Planned', 'godam' ),
				badgeVariant: 'neutral',
			},
		],
	},
];
