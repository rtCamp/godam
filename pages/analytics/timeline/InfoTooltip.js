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
		<Tooltip text={ text }>
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
