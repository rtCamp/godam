/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Pill-toggle for the timeline's global date range. 7D / 30D / 90D / 1Y.
 *
 * Plain unstyled radio group via buttons — matches the mockup. Selected
 * pill gets a soft pink-tinted background so it reads as the active
 * filter; remaining pills are neutral.
 *
 * @param {Object}   props
 * @param {string}   props.value    Currently selected key.
 * @param {Function} props.onChange (next) => void.
 * @return {JSX.Element} Toggle group.
 */
const DateRangePicker = ( { value, onChange } ) => {
	const options = [
		{ id: '7d', label: __( '7D', 'godam' ), aria: __( 'Last 7 days', 'godam' ) },
		{ id: '30d', label: __( '30D', 'godam' ), aria: __( 'Last 30 days', 'godam' ) },
		{ id: '90d', label: __( '90D', 'godam' ), aria: __( 'Last 90 days', 'godam' ) },
		{ id: '1y', label: __( '1Y', 'godam' ), aria: __( 'Last year', 'godam' ) },
	];

	return (
		<div
			role="radiogroup"
			aria-label={ __( 'Date range', 'godam' ) }
			className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
		>
			{ options.map( ( opt ) => {
				const active = value === opt.id;
				return (
					<button
						key={ opt.id }
						type="button"
						role="radio"
						aria-checked={ active }
						aria-label={ opt.aria }
						onClick={ () => onChange( opt.id ) }
						className="text-sm font-medium px-3 py-1.5 cursor-pointer border-0 rounded-md tabular-nums"
						style={ {
							background: active ? '#FCE7F3' : 'transparent',
							color: active ? '#BE185D' : '#475569',
							transition: 'background-color 140ms ease-out, color 140ms ease-out',
						} }
					>
						{ opt.label }
					</button>
				);
			} ) }
		</div>
	);
};

export default DateRangePicker;
