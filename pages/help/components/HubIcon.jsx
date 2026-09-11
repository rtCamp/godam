/**
 * Line icons used by the documentation hub cards.
 *
 * They mirror the icon set on the GoDAM docs landing page: a 24×24 grid,
 * `currentColor` strokes at 1.6 and round caps/joins, so the colour follows
 * the admin theme through the surrounding CSS.
 */
const ICONS = {
	wordpress: (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M3 9h18M7 13h6M7 16h9" />
		</>
	),
	woocommerce: (
		<>
			<circle cx="9" cy="20" r="1.4" />
			<circle cx="18" cy="20" r="1.4" />
			<path d="M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21.5 7H6" />
		</>
	),
	shopify: (
		<>
			<path d="M6 8h12l1 12H5L6 8Z" />
			<path d="M9 8V6a3 3 0 0 1 6 0v2" />
		</>
	),
	central: (
		<>
			<circle cx="12" cy="12" r="2.6" />
			<circle cx="12" cy="4" r="1.8" />
			<circle cx="12" cy="20" r="1.8" />
			<circle cx="4.5" cy="8" r="1.8" />
			<circle cx="19.5" cy="8" r="1.8" />
			<path d="M12 6.6v2.8M12 14.6v3.6M9.7 10.8 6 9M14.3 10.8 18 9" />
		</>
	),
	platform: (
		<>
			<circle cx="12" cy="12" r="3.2" />
			<path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
		</>
	),
	chrome: (
		<>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="3.2" />
			<path d="M12 8.8h8.5M8.6 6.5 4.4 13M15.4 13l-4 7.5" />
		</>
	),
	ios: (
		<>
			<rect x="7" y="2.5" width="10" height="19" rx="2.5" />
			<path d="M10.5 18.5h3" />
		</>
	),
	macos: (
		<>
			<rect x="4" y="5" width="16" height="11" rx="1.5" />
			<path d="M2 20h20" />
		</>
	),
	android: (
		<>
			<rect x="6" y="8" width="12" height="9" rx="2" />
			<path d="M9 8V6M15 8V6M9.5 12h.01M14.5 12h.01M4 11v3M20 11v3" />
		</>
	),
	search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.1-4.1" />,
};

const HubIcon = ( { name } ) => {
	const paths = ICONS[ name ];

	if ( ! paths ) {
		return null;
	}

	return (
		<svg
			className="godam-help-icon"
			viewBox="0 0 24 24"
			width="24"
			height="24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{ paths }
		</svg>
	);
};

export default HubIcon;
