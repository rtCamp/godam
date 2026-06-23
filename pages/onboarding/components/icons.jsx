/**
 * Inline SVG icon set for the onboarding SPA.
 *
 * Kept local (rather than @wordpress/icons) so the line weight / sizing match
 * the Figma exactly and the multi-colour Google mark renders correctly.
 */

const stroke = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.6,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
};

export const GlobeIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<circle cx="12" cy="12" r="9" { ...stroke } />
		<path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" { ...stroke } />
	</svg>
);

export const GaugeIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<path d="M4 18a8 8 0 1 1 16 0" { ...stroke } />
		<path d="M12 14l4-4" { ...stroke } />
	</svg>
);

export const TeamIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<circle cx="9" cy="8" r="3" { ...stroke } />
		<path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.8M20.5 19a5 5 0 0 0-3.5-4.7" { ...stroke } />
	</svg>
);

export const ShieldIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" { ...stroke } />
	</svg>
);

export const StorageIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<rect x="4" y="4" width="16" height="6" rx="1.5" { ...stroke } />
		<rect x="4" y="14" width="16" height="6" rx="1.5" { ...stroke } />
		<path d="M8 7h.01M8 17h.01" { ...stroke } />
	</svg>
);

export const MailIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<rect x="3" y="5" width="18" height="14" rx="2" { ...stroke } />
		<path d="M4 7l8 6 8-6" { ...stroke } />
	</svg>
);

export const KeyIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { ...props }>
		<circle cx="8" cy="14" r="4" { ...stroke } />
		<path d="M11 11l9-9M17 5l3 3M14 8l2 2" { ...stroke } />
	</svg>
);

export const CheckIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" { ...props }>
		<path d="M5 12l5 5L20 7" { ...stroke } />
	</svg>
);

export const GoogleIcon = ( props ) => (
	<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" { ...props }>
		<path fill="#4285F4" d="M21.6 12.2c0-.6-.05-1.2-.16-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z" />
		<path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .95-3.4.95-2.6 0-4.8-1.75-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
		<path fill="#FBBC05" d="M6.4 13.95a6 6 0 0 1 0-3.9V7.45H3.1a10 10 0 0 0 0 9.1l3.3-2.6z" />
		<path fill="#EA4335" d="M12 5.95c1.5 0 2.8.5 3.8 1.5l2.85-2.85A10 10 0 0 0 3.1 7.45l3.3 2.6C7.2 7.7 9.4 5.95 12 5.95z" />
	</svg>
);

export const FEATURE_ICONS = {
	globe: GlobeIcon,
	gauge: GaugeIcon,
	team: TeamIcon,
	shield: ShieldIcon,
	storage: StorageIcon,
};
