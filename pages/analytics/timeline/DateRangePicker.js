/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { Dropdown, Button, MenuGroup, MenuItem, Icon } from '@wordpress/components';
import { chevronDown } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Date-range dropdown for the timeline's global range. 7D / 30D / 90D / 1Y / All.
 *
 * Mirrors the Playback Performance chart's range dropdown (same `Dropdown` +
 * secondary `Button` + `MenuGroup` pattern and `godam-period-dropdown` styling)
 * so both range pickers on the analytics page look and behave identically and
 * follow the WP admin colour scheme. "All" maps to no `days` param so the
 * microservice returns the full history (see rangeToDays in useVideoLayerData).
 *
 * @param {Object}   props
 * @param {string}   props.value    Currently selected key ('7d' | '30d' | '90d' | '1y' | 'all').
 * @param {Function} props.onChange (next) => void.
 * @return {JSX.Element} Range dropdown.
 */
const DateRangePicker = ( { value, onChange } ) => {
	const options = [
		{ id: '7d', label: __( 'Last 7 days', 'godam' ) },
		{ id: '30d', label: __( 'Last 30 days', 'godam' ) },
		{ id: '90d', label: __( 'Last 90 days', 'godam' ) },
		{ id: '1y', label: __( 'Last year', 'godam' ) },
		{ id: 'all', label: __( 'All time', 'godam' ) },
	];

	const currentLabel =
		options.find( ( o ) => o.id === value )?.label || options[ 0 ].label;

	// Fold the current selection into the toggle's accessible name so screen
	// readers keep it (a bare aria-label="Date range" overrode it — Copilot note).
	const rangeAriaLabel = sprintf(
		/* translators: %s: the selected range label, e.g. "Last 7 days". */
		__( 'Date range: %s', 'godam' ),
		currentLabel,
	);

	return (
		<Dropdown
			className="godam-period-dropdown"
			popoverProps={ { placement: 'bottom-end' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					variant="secondary"
					onClick={ onToggle }
					aria-expanded={ isOpen }
					aria-label={ rangeAriaLabel }
					className="godam-period-dropdown__toggle"
				>
					{ currentLabel }
					<Icon icon={ chevronDown } size={ 20 } />
				</Button>
			) }
			renderContent={ ( { onClose } ) => (
				<MenuGroup>
					{ options.map( ( opt ) => (
						<MenuItem
							key={ opt.id }
							isSelected={ value === opt.id }
							onClick={ () => {
								onChange( opt.id );
								onClose();
							} }
						>
							{ opt.label }
						</MenuItem>
					) ) }
				</MenuGroup>
			) }
		/>
	);
};

export default DateRangePicker;
