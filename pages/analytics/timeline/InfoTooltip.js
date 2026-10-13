/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Tooltip, Icon } from '@wordpress/components';
import { info } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './InfoTooltip.scss';

/**
 * Info-icon trigger paired with the WordPress `<Tooltip>` popover.
 *
 * `<Tooltip>` requires its child to be a focusable element so the popover
 * can attach to hover + keyboard focus. We wrap the info glyph in a
 * borderless button styled to read as the same neutral icon that lived in
 * the header before; behaviour-wise it's now keyboard-accessible.
 *
 * Replaces the native `title` attribute we had previously — those only
 * fire after the browser's ~700ms hover delay and can't be styled. The
 * WP popover appears immediately on hover, supports rich text, and
 * matches the existing dashboard's tooltip language.
 *
 * @param {Object} props
 * @param {string} props.text        Tooltip body (already localised by caller).
 * @param {number} [props.size]      Icon size in px. Defaults to 14.
 * @param {string} [props.ariaLabel] Optional aria-label override; defaults to "Info".
 * @return {JSX.Element} Tooltip-wrapped button.
 */
const InfoTooltip = ( { text, size = 14, ariaLabel } ) => {
	return (
		// `placement="bottom"` drops the popover below the icon (like the
		// dashboard's standard-metric tooltips) instead of over the content
		// above. `className` lands on the `.components-tooltip` popover so the
		// `.godam-readable-tooltip` rule (analytics index.scss) can cap its
		// width and let long copy wrap — the default WP tooltip renders on a
		// single unreadable line. The popover still portals to <body>, so it's
		// never clipped inside the timeline's overflow-hidden cards.
		<Tooltip text={ text } placement="bottom" className="godam-readable-tooltip">
			<button
				type="button"
				aria-label={ ariaLabel || __( 'Info', 'godam' ) }
				className="inline-flex items-center justify-center bg-transparent border-0 p-0 text-zinc-400 hover:text-zinc-600 focus:text-zinc-600"
				style={ { cursor: 'help', lineHeight: 0 } }
			>
				<Icon icon={ info } size={ size } />
			</button>
		</Tooltip>
	);
};

export default InfoTooltip;
