/**
 * External dependencies
 */
import React, { useEffect, useMemo, useState } from 'react';

/**
 * WordPress dependencies
 */
import { Dropdown, Button, MenuGroup, MenuItem, Icon } from '@wordpress/components';
import { chevronDown, chevronLeft, chevronRight, calendar } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './style.scss';

/**
 * Shared analytics date-range picker (godam-plugin-wp#2, W1 + W5).
 *
 * Matches the Figma "Analytics Final" flow: a compact pill trigger showing the
 * current selection, opening a popover with quick presets (7 Days / 15 Days /
 * 1 Month / All Time) plus a "Date Range" custom-calendar mode with start+end
 * range selection. Emits an ISO { startDate, endDate } pair (both null = All
 * Time) which callers thread into the analytics REST queries as
 * start_date / end_date.
 *
 * Controlled by `value`; the picker keeps only presentational state (which
 * preset is active, the open calendar month, an in-progress custom selection).
 *
 * @param {Object}   props
 * @param {Object}   props.value          Current range: { startDate, endDate } ISO strings or null.
 * @param {Function} props.onChange       (next: { startDate, endDate }) => void.
 * @param {string}   [props.testIdPrefix] Prefix for data-test-id hooks.
 * @return {JSX.Element} The picker.
 */

// Local-midnight Date -> 'YYYY-MM-DD'.
const toISO = ( date ) => {
	const y = date.getFullYear();
	const m = String( date.getMonth() + 1 ).padStart( 2, '0' );
	const d = String( date.getDate() ).padStart( 2, '0' );
	return `${ y }-${ m }-${ d }`;
};

// 'YYYY-MM-DD' -> local Date (midnight); null-safe.
const fromISO = ( iso ) => {
	if ( ! iso ) {
		return null;
	}
	const [ y, m, d ] = iso.split( '-' ).map( Number );
	return new Date( y, m - 1, d );
};

// Today at local midnight.
const today = () => {
	const t = new Date();
	return new Date( t.getFullYear(), t.getMonth(), t.getDate() );
};

// Short human label, e.g. "Nov 7".
const shortLabel = ( date ) =>
	date.toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );

// Quick presets. `resolve` returns the ISO { startDate, endDate } pair; a
// span of N days is [today-(N-1) .. today] so it is inclusive of today.
const PRESETS = [
	{
		key: '7d',
		menuLabel: __( '7 Days', 'godam' ),
		triggerLabel: __( 'Last 7 days', 'godam' ),
		resolve: () => spanDays( 7 ),
	},
	{
		key: '15d',
		menuLabel: __( '15 Days', 'godam' ),
		triggerLabel: __( 'Last 15 days', 'godam' ),
		resolve: () => spanDays( 15 ),
	},
	{
		key: '1m',
		menuLabel: __( '1 Month', 'godam' ),
		triggerLabel: __( 'Last 1 month', 'godam' ),
		resolve: () => spanDays( 30 ),
	},
	{
		key: 'all',
		menuLabel: __( 'All Time', 'godam' ),
		triggerLabel: __( 'All Time', 'godam' ),
		resolve: () => ( { startDate: null, endDate: null } ),
	},
];

function spanDays( n ) {
	const end = today();
	// Calendar arithmetic (not fixed-ms subtraction): the Date constructor
	// normalises the day field while keeping local midnight, so a DST
	// spring-forward inside the window can't push the start an hour before
	// midnight and make toISO() report the previous calendar day.
	const start = new Date( end.getFullYear(), end.getMonth(), end.getDate() - ( n - 1 ) );
	return { startDate: toISO( start ), endDate: toISO( end ) };
}

// Which preset (if any) a { startDate, endDate } value corresponds to.
function matchPreset( value ) {
	const { startDate = null, endDate = null } = value || {};
	if ( ! startDate && ! endDate ) {
		return 'all';
	}
	const hit = PRESETS.find( ( p ) => {
		if ( p.key === 'all' ) {
			return false;
		}
		const r = p.resolve();
		return r.startDate === startDate && r.endDate === endDate;
	} );
	return hit ? hit.key : 'custom';
}

// Trigger button label for the current value.
function triggerLabelFor( value ) {
	const key = matchPreset( value );
	if ( key === 'custom' ) {
		const s = fromISO( value.startDate );
		const e = fromISO( value.endDate );
		if ( s && e ) {
			return sprintf(
				/* translators: 1: range start (e.g. "Nov 7"), 2: range end (e.g. "Nov 13"). */
				__( '%1$s - %2$s', 'godam' ),
				shortLabel( s ),
				shortLabel( e ),
			);
		}
		if ( s ) {
			return sprintf(
				/* translators: %s: range start date, e.g. "Nov 7". */
				__( 'From %s', 'godam' ),
				shortLabel( s ),
			);
		}
	}
	return PRESETS.find( ( p ) => p.key === key )?.triggerLabel || PRESETS[ 3 ].triggerLabel;
}

// Days (incl. spillover) for a month grid starting on Sunday.
function monthGrid( viewDate ) {
	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const first = new Date( year, month, 1 );
	const gridStartDay = 1 - first.getDay();
	return Array.from( { length: 42 }, ( _, i ) => {
		// Calendar arithmetic (not fixed-ms): keeps every cell at local
		// midnight so a DST fall-back in the month can't drift later cells to
		// 23:00 of the prior day (which would duplicate a day number and
		// misalign selection/highlighting).
		const d = new Date( year, month, gridStartDay + i );
		return { date: d, inMonth: d.getMonth() === month };
	} );
}

const WEEKDAYS = [
	__( 'Su', 'godam' ),
	__( 'Mo', 'godam' ),
	__( 'Tu', 'godam' ),
	__( 'We', 'godam' ),
	__( 'Th', 'godam' ),
	__( 'Fr', 'godam' ),
	__( 'Sa', 'godam' ),
];

const DateRangePicker = ( { value = {}, onChange, testIdPrefix = 'godam-analytics-daterange' } ) => {
	const activeKey = matchPreset( value );
	const label = triggerLabelFor( value );

	return (
		<Dropdown
			className="godam-daterange-dropdown godam-period-dropdown"
			popoverProps={ { placement: 'bottom-end' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					variant="secondary"
					onClick={ onToggle }
					aria-expanded={ isOpen }
					aria-label={ sprintf(
						/* translators: %s: the selected range label. */
						__( 'Date range: %s', 'godam' ),
						label,
					) }
					className="godam-period-dropdown__toggle"
					data-test-id={ `${ testIdPrefix }-toggle` }
				>
					{ label }
					<Icon icon={ chevronDown } size={ 20 } />
				</Button>
			) }
			renderContent={ ( { onClose } ) => (
				<DateRangePanel
					value={ value }
					activeKey={ activeKey }
					testIdPrefix={ testIdPrefix }
					onSelect={ ( next ) => {
						onChange( next );
						onClose();
					} }
				/>
			) }
		/>
	);
};

// Popover body: preset list + optional custom-range calendar.
const DateRangePanel = ( { value, activeKey, testIdPrefix, onSelect } ) => {
	const [ showCalendar, setShowCalendar ] = useState( activeKey === 'custom' );
	// Keep the calendar's visibility in sync when the controlled value changes
	// while the panel stays mounted (e.g. a preset is picked, or the parent
	// updates the range externally) — otherwise showCalendar would be stuck at
	// its initial value. Only fires on an actual activeKey change, so the manual
	// "Custom range" toggle (which doesn't change activeKey) is preserved.
	useEffect( () => {
		setShowCalendar( activeKey === 'custom' );
	}, [ activeKey ] );
	const initialMonth = useMemo(
		() => fromISO( value?.startDate ) || today(),
		[ value ],
	);
	const [ viewMonth, setViewMonth ] = useState(
		new Date( initialMonth.getFullYear(), initialMonth.getMonth(), 1 ),
	);
	// In-progress selection: pick start, then end.
	const [ pendingStart, setPendingStart ] = useState(
		activeKey === 'custom' ? fromISO( value?.startDate ) : null,
	);
	const [ pendingEnd, setPendingEnd ] = useState(
		activeKey === 'custom' ? fromISO( value?.endDate ) : null,
	);

	const grid = useMemo( () => monthGrid( viewMonth ), [ viewMonth ] );
	const maxDate = today();

	const onDayClick = ( date ) => {
		if ( date > maxDate ) {
			return; // no future dates
		}
		if ( ! pendingStart || ( pendingStart && pendingEnd ) ) {
			// Begin a new range.
			setPendingStart( date );
			setPendingEnd( null );
			return;
		}
		// Second click completes the range (swap if before start).
		let start = pendingStart;
		let end = date;
		if ( end < start ) {
			[ start, end ] = [ end, start ];
		}
		setPendingStart( start );
		setPendingEnd( end );
		onSelect( { startDate: toISO( start ), endDate: toISO( end ) } );
	};

	const inRange = ( date ) => {
		if ( ! pendingStart ) {
			return false;
		}
		const end = pendingEnd || pendingStart;
		return date >= pendingStart && date <= end;
	};
	const isEndpoint = ( date ) =>
		( pendingStart && date.getTime() === pendingStart.getTime() ) ||
		( pendingEnd && date.getTime() === pendingEnd.getTime() );

	return (
		<div className="godam-daterange" data-test-id={ `${ testIdPrefix }-panel` }>
			{ showCalendar && (
				<div className="godam-daterange__calendar">
					<div className="godam-daterange__cal-head">
						<Button
							size="small"
							icon={ chevronLeft }
							label={ __( 'Previous month', 'godam' ) }
							onClick={ () =>
								setViewMonth(
									new Date( viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1 ),
								)
							}
						/>
						<span className="godam-daterange__cal-title">
							{ viewMonth.toLocaleDateString( undefined, {
								month: 'long',
								year: 'numeric',
							} ) }
						</span>
						<Button
							size="small"
							icon={ chevronRight }
							label={ __( 'Next month', 'godam' ) }
							onClick={ () =>
								setViewMonth(
									new Date( viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1 ),
								)
							}
						/>
					</div>
					<div className="godam-daterange__weekdays">
						{ WEEKDAYS.map( ( w ) => (
							<span key={ w }>{ w }</span>
						) ) }
					</div>
					<div className="godam-daterange__grid">
						{ grid.map( ( { date, inMonth }, i ) => {
							const disabled = date > maxDate;
							const isRangeDay = inRange( date );
							const isEnd = isEndpoint( date );
							const classes = [ 'godam-daterange__day' ];
							if ( ! inMonth ) {
								classes.push( 'is-outside' );
							}
							if ( disabled ) {
								classes.push( 'is-disabled' );
							}
							if ( isRangeDay ) {
								classes.push( 'is-in-range' );
							}
							if ( isEnd ) {
								classes.push( 'is-endpoint' );
							}
							// The visible label is just the day number, which a
							// screen reader can't disambiguate across months/years,
							// so expose the full localized date + selection state.
							const dayLabel = date.toLocaleDateString( undefined, {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							} );
							return (
								<button
									type="button"
									key={ i }
									className={ classes.join( ' ' ) }
									disabled={ disabled }
									aria-label={ dayLabel }
									aria-pressed={ isEnd || isRangeDay }
									onClick={ () => onDayClick( date ) }
								>
									{ date.getDate() }
								</button>
							);
						} ) }
					</div>
				</div>
			) }

			<MenuGroup className="godam-daterange__presets">
				{ PRESETS.map( ( p ) => (
					<MenuItem
						key={ p.key }
						isSelected={ ! showCalendar && activeKey === p.key }
						onClick={ () => onSelect( p.resolve() ) }
						data-test-id={ `${ testIdPrefix }-preset-${ p.key }` }
					>
						{ p.menuLabel }
					</MenuItem>
				) ) }
				<MenuItem
					className="godam-daterange__custom-toggle"
					isSelected={ showCalendar }
					icon={ calendar }
					onClick={ () => setShowCalendar( true ) }
					data-test-id={ `${ testIdPrefix }-custom` }
				>
					{ __( 'Date Range', 'godam' ) }
				</MenuItem>
			</MenuGroup>
		</div>
	);
};

export default DateRangePicker;
export { PRESETS, spanDays, matchPreset, triggerLabelFor, toISO, fromISO };
